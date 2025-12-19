package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var ListFolderToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "list_folder",
			Description: param.NewOpt("Lists the contents of a folder (directory) at the specified path. Can optionally list recursively."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path of the folder to list.",
					},
					"recursive": map[string]any{
						"type":        "boolean",
						"description": "If true, list contents recursively including all subdirectories. Default is false.",
					},
					"max_depth": map[string]any{
						"type":        "integer",
						"description": "Maximum depth to recurse when recursive is true. Default is unlimited.",
					},
					"pattern": map[string]any{
						"type":        "string",
						"description": "Optional glob pattern to filter results (e.g., '*.go', '*.py').",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type ListFolderArgs struct {
	Path      string `json:"path"`
	Recursive *bool  `json:"recursive,omitempty"`
	MaxDepth  *int   `json:"max_depth,omitempty"`
	Pattern   string `json:"pattern,omitempty"`
}

type ListFolderTool struct {
	projectService *services.ProjectService
}

func NewListFolderTool(projectService *services.ProjectService) *ListFolderTool {
	return &ListFolderTool{
		projectService: projectService,
	}
}

type folderEntry struct {
	path  string
	isDir bool
}

func (t *ListFolderTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ListFolderArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	recursive := false
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
	}

	maxDepth := -1 // unlimited
	if getArgs.MaxDepth != nil {
		maxDepth = *getArgs.MaxDepth
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
	if searchPath == "" || searchPath == "." {
		searchPath = ""
	}

	// Collect matching entries and directories
	entriesMap := make(map[string]folderEntry)
	dirsSet := make(map[string]bool)

	for _, doc := range project.Docs {
		docPath := normalizePath(doc.Filepath)

		// Check if file is within the search path
		var relativePath string
		if searchPath == "" {
			relativePath = docPath
		} else {
			if !strings.HasPrefix(docPath, searchPath+"/") && docPath != searchPath {
				continue
			}
			relativePath = strings.TrimPrefix(docPath, searchPath+"/")
		}

		// Calculate depth relative to search path
		pathDepth := strings.Count(relativePath, "/")

		// Filter by depth
		if !recursive && pathDepth > 0 {
			// Show only direct children (files and immediate subdirectories)
			parts := strings.SplitN(relativePath, "/", 2)
			if len(parts) > 1 {
				// This is a subdirectory
				dirName := parts[0]
				fullDirPath := searchPath
				if fullDirPath != "" {
					fullDirPath += "/"
				}
				fullDirPath += dirName
				if !dirsSet[fullDirPath] {
					dirsSet[fullDirPath] = true
					entriesMap[fullDirPath] = folderEntry{path: fullDirPath, isDir: true}
				}
				continue
			}
		} else if recursive && maxDepth >= 0 && pathDepth > maxDepth {
			continue
		}

		// Apply pattern filter
		if getArgs.Pattern != "" {
			fileName := filepath.Base(docPath)
			matched, err := filepath.Match(getArgs.Pattern, fileName)
			if err != nil {
				matched = strings.Contains(strings.ToLower(fileName), strings.ToLower(getArgs.Pattern))
			}
			if !matched {
				continue
			}
		}

		// Add parent directories for recursive listing
		if recursive {
			dir := filepath.Dir(docPath)
			for dir != "." && dir != "/" && dir != "" && strings.HasPrefix(dir, searchPath) {
				if !dirsSet[dir] {
					dirsSet[dir] = true
					entriesMap[dir] = folderEntry{path: dir, isDir: true}
				}
				dir = filepath.Dir(dir)
			}
		}

		entriesMap[docPath] = folderEntry{path: docPath, isDir: false}
	}

	if len(entriesMap) == 0 {
		return fmt.Sprintf("Folder '%s' is empty or does not exist", getArgs.Path), "", nil
	}

	// Sort entries
	var entries []folderEntry
	for _, e := range entriesMap {
		entries = append(entries, e)
	}
	sort.Slice(entries, func(i, j int) bool {
		// Directories first, then alphabetically
		if entries[i].isDir != entries[j].isDir {
			return entries[i].isDir
		}
		return entries[i].path < entries[j].path
	})

	var result strings.Builder
	displayPath := getArgs.Path
	if displayPath == "" || displayPath == "." {
		displayPath = "/"
	}
	result.WriteString(fmt.Sprintf("Contents of '%s':\n\n", displayPath))

	for _, entry := range entries {
		displayName := entry.path
		if searchPath != "" && strings.HasPrefix(displayName, searchPath+"/") {
			displayName = strings.TrimPrefix(displayName, searchPath+"/")
		}
		if entry.isDir {
			result.WriteString(fmt.Sprintf("  📁 %s/\n", displayName))
		} else {
			result.WriteString(fmt.Sprintf("  📄 %s\n", displayName))
		}
	}

	return result.String(), "", nil
}
