package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var SearchStringToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "search_string",
			Description: param.NewOpt("Searches for a string pattern in files within a specified directory. Supports regex patterns and can limit results."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern": map[string]any{
						"type":        "string",
						"description": "The search pattern (string or regex) to look for.",
					},
					"path": map[string]any{
						"type":        "string",
						"description": "The directory path to search within.",
					},
					"file_pattern": map[string]any{
						"type":        "string",
						"description": "Optional glob pattern to filter files (e.g., '*.go', '*.py'). Default is all files.",
					},
					"case_sensitive": map[string]any{
						"type":        "boolean",
						"description": "Whether the search should be case-sensitive. Default is true.",
					},
					"max_results": map[string]any{
						"type":        "integer",
						"description": "Maximum number of results to return. Default is 100.",
					},
				},
				"required": []string{"pattern", "path"},
			},
		},
	},
}

type SearchStringArgs struct {
	Pattern       string `json:"pattern"`
	Path          string `json:"path"`
	FilePattern   string `json:"file_pattern,omitempty"`
	CaseSensitive *bool  `json:"case_sensitive,omitempty"`
	MaxResults    *int   `json:"max_results,omitempty"`
}

type SearchStringTool struct {
	projectService *services.ProjectService
}

func NewSearchStringTool(projectService *services.ProjectService) *SearchStringTool {
	return &SearchStringTool{
		projectService: projectService,
	}
}

type searchResult struct {
	FilePath   string
	LineNumber int
	Content    string
}

func (t *SearchStringTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchStringArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	caseSensitive := true
	if getArgs.CaseSensitive != nil {
		caseSensitive = *getArgs.CaseSensitive
	}
	maxResults := 100
	if getArgs.MaxResults != nil {
		maxResults = *getArgs.MaxResults
	}

	// Get project from context
	actor, projectId, _ := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" {
		return "", "", fmt.Errorf("failed to get actor or project id from context")
	}

	project, err := t.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", fmt.Errorf("failed to get project: %w", err)
	}

	// Normalize search path
	searchPath := normalizePath(getArgs.Path)

	// Compile regex if possible, otherwise use string matching
	var regex *regexp.Regexp
	searchPattern := getArgs.Pattern
	if !caseSensitive {
		searchPattern = "(?i)" + searchPattern
	}
	regex, regexErr := regexp.Compile(searchPattern)
	if regexErr != nil {
		// Fall back to literal string matching
		regex = nil
	}

	var results []searchResult
	resultsCount := 0

	for _, doc := range project.Docs {
		if resultsCount >= maxResults {
			break
		}

		docPath := normalizePath(doc.Filepath)

		// Check if file is within the search path
		if searchPath != "" && searchPath != "." && searchPath != "/" {
			if !strings.HasPrefix(docPath, searchPath+"/") && docPath != searchPath {
				continue
			}
		}

		// Apply file pattern filter
		if getArgs.FilePattern != "" {
			fileName := filepath.Base(docPath)
			matched, err := filepath.Match(getArgs.FilePattern, fileName)
			if err != nil {
				matched = strings.Contains(strings.ToLower(fileName), strings.ToLower(getArgs.FilePattern))
			}
			if !matched {
				continue
			}
		}

		// Search through lines
		for lineNum, line := range doc.Lines {
			if resultsCount >= maxResults {
				break
			}

			var found bool
			if regex != nil {
				found = regex.MatchString(line)
			} else {
				// Literal string match
				if caseSensitive {
					found = strings.Contains(line, getArgs.Pattern)
				} else {
					found = strings.Contains(strings.ToLower(line), strings.ToLower(getArgs.Pattern))
				}
			}

			if found {
				results = append(results, searchResult{
					FilePath:   doc.Filepath,
					LineNumber: lineNum + 1, // 1-indexed
					Content:    line,
				})
				resultsCount++
			}
		}
	}

	if len(results) == 0 {
		return fmt.Sprintf("No results found for pattern '%s' in '%s'", getArgs.Pattern, getArgs.Path), "", nil
	}

	var sb strings.Builder
	if resultsCount >= maxResults {
		sb.WriteString(fmt.Sprintf("Found %d+ matches for pattern '%s' (showing first %d):\n\n", resultsCount, getArgs.Pattern, maxResults))
	} else {
		sb.WriteString(fmt.Sprintf("Found %d match(es) for pattern '%s':\n\n", len(results), getArgs.Pattern))
	}

	for _, r := range results {
		// Truncate long lines for display
		content := r.Content
		if len(content) > 100 {
			content = content[:100] + "..."
		}
		sb.WriteString(fmt.Sprintf("%s:%d: %s\n", r.FilePath, r.LineNumber, strings.TrimSpace(content)))
	}

	return sb.String(), "", nil
}

// SearchStringToolLegacy for backward compatibility (standalone function)
func SearchStringToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchStringArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	caseSensitive := true
	if getArgs.CaseSensitive != nil {
		caseSensitive = *getArgs.CaseSensitive
	}
	maxResults := 100
	if getArgs.MaxResults != nil {
		maxResults = *getArgs.MaxResults
	}
	filePattern := "*"
	if getArgs.FilePattern != "" {
		filePattern = getArgs.FilePattern
	}

	// TODO: This legacy function doesn't have access to ProjectService
	return fmt.Sprintf("[WARNING] search_string tool not properly initialized. Requested: pattern '%s' in '%s' (file_pattern: %s, case_sensitive: %v, max_results: %d)",
		getArgs.Pattern, getArgs.Path, filePattern, caseSensitive, maxResults), "", nil
}
