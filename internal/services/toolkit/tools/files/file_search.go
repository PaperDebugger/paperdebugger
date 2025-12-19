package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var SearchFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "search_file",
			Description: param.NewOpt("Searches for files by name or pattern within a specified directory. Returns matching file paths."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The directory path to search within.",
					},
					"pattern": map[string]any{
						"type":        "string",
						"description": "The file name pattern to search for (supports glob patterns like '*.go', 'test_*.py').",
					},
					"recursive": map[string]any{
						"type":        "boolean",
						"description": "If true, search recursively in subdirectories. Default is true.",
					},
					"max_results": map[string]any{
						"type":        "integer",
						"description": "Maximum number of results to return. Default is 100.",
					},
				},
				"required": []string{"path", "pattern"},
			},
		},
	},
}

type SearchFileArgs struct {
	Path       string `json:"path"`
	Pattern    string `json:"pattern"`
	Recursive  *bool  `json:"recursive,omitempty"`
	MaxResults *int   `json:"max_results,omitempty"`
}

type SearchFileTool struct {
	projectService *services.ProjectService
}

func NewSearchFileTool(projectService *services.ProjectService) *SearchFileTool {
	return &SearchFileTool{
		projectService: projectService,
	}
}

func (t *SearchFileTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	recursive := true
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
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

	var matchingFiles []string
	for _, doc := range project.Docs {
		docPath := normalizePath(doc.Filepath)

		// Check if file is within the search path
		if searchPath != "" && searchPath != "." && searchPath != "/" {
			if !strings.HasPrefix(docPath, searchPath+"/") && docPath != searchPath {
				dir := filepath.Dir(docPath)
				if !recursive && dir != searchPath {
					continue
				}
				if recursive && !strings.HasPrefix(docPath, searchPath) {
					continue
				}
			}
		}

		// Match against the pattern (glob-style)
		fileName := filepath.Base(docPath)
		matched, err := filepath.Match(getArgs.Pattern, fileName)
		if err != nil {
			// If pattern is invalid, try substring match
			matched = strings.Contains(strings.ToLower(fileName), strings.ToLower(getArgs.Pattern))
		}

		if matched {
			matchingFiles = append(matchingFiles, doc.Filepath)
			if len(matchingFiles) >= maxResults {
				break
			}
		}
	}

	if len(matchingFiles) == 0 {
		return fmt.Sprintf("No files found matching pattern '%s' in '%s'", getArgs.Pattern, getArgs.Path), "", nil
	}

	var result strings.Builder
	result.WriteString(fmt.Sprintf("Found %d file(s) matching pattern '%s' in '%s':\n\n", len(matchingFiles), getArgs.Pattern, getArgs.Path))
	for _, f := range matchingFiles {
		result.WriteString(fmt.Sprintf("  %s\n", f))
	}

	return result.String(), "", nil
}

// SearchFileToolLegacy for backward compatibility (standalone function)
func SearchFileToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	recursive := true
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
	}
	maxResults := 100
	if getArgs.MaxResults != nil {
		maxResults = *getArgs.MaxResults
	}

	// TODO: This legacy function doesn't have access to ProjectService
	return fmt.Sprintf("[WARNING] search_file tool not properly initialized. Requested: pattern '%s' in '%s' (recursive: %v, max_results: %d)",
		getArgs.Pattern, getArgs.Path, recursive, maxResults), "", nil
}
