package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var ReadFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "read_file",
			Description: param.NewOpt("Reads the content of a file at the specified path. Supports reading specific line ranges."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path of the file to read.",
					},
					"start_line": map[string]any{
						"type":        "integer",
						"description": "Optional. The starting line number (1-indexed) to read from. If not specified, reads from the beginning.",
					},
					"end_line": map[string]any{
						"type":        "integer",
						"description": "Optional. The ending line number (1-indexed, inclusive) to read to. If not specified, reads to the end.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type ReadFileArgs struct {
	Path      string `json:"path"`
	StartLine *int   `json:"start_line,omitempty"`
	EndLine   *int   `json:"end_line,omitempty"`
}

type ReadFileTool struct {
	projectService *services.ProjectService
}

func NewReadFileTool(projectService *services.ProjectService) *ReadFileTool {
	return &ReadFileTool{
		projectService: projectService,
	}
}

func (t *ReadFileTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
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

	// Normalize the path for matching
	targetPath := normalizePath(getArgs.Path)

	// Find the document by path
	var foundDoc *struct {
		Lines    []string
		Filepath string
	}
	for _, doc := range project.Docs {
		docPath := normalizePath(doc.Filepath)
		if docPath == targetPath || strings.HasSuffix(docPath, "/"+targetPath) || docPath == "/"+targetPath {
			foundDoc = &struct {
				Lines    []string
				Filepath string
			}{Lines: doc.Lines, Filepath: doc.Filepath}
			break
		}
	}

	if foundDoc == nil {
		return fmt.Sprintf("File not found: %s", getArgs.Path), "", nil
	}

	lines := foundDoc.Lines
	totalLines := len(lines)

	// Apply line range filtering
	startIdx := 0
	endIdx := totalLines

	if getArgs.StartLine != nil {
		startIdx = *getArgs.StartLine - 1 // Convert to 0-indexed
		if startIdx < 0 {
			startIdx = 0
		}
		if startIdx >= totalLines {
			startIdx = totalLines
		}
	}

	if getArgs.EndLine != nil {
		endIdx = *getArgs.EndLine // EndLine is inclusive, so we use it directly
		if endIdx > totalLines {
			endIdx = totalLines
		}
		if endIdx < 0 {
			endIdx = 0
		}
	}

	if startIdx >= endIdx {
		return "No content in the specified line range", "", nil
	}

	// Build result with line numbers
	var result strings.Builder
	result.WriteString(fmt.Sprintf("File: %s (lines %d-%d of %d)\n\n", foundDoc.Filepath, startIdx+1, endIdx, totalLines))

	for i := startIdx; i < endIdx; i++ {
		result.WriteString(fmt.Sprintf("%4d: %s\n", i+1, lines[i]))
	}

	return result.String(), "", nil
}

// normalizePath removes leading slashes and normalizes path separators
func normalizePath(path string) string {
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimPrefix(path, "./")
	return path
}

// ReadFileToolLegacy for backward compatibility (standalone function)
func ReadFileToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	lineRange := "all"
	if getArgs.StartLine != nil && getArgs.EndLine != nil {
		lineRange = fmt.Sprintf("lines %d-%d", *getArgs.StartLine, *getArgs.EndLine)
	} else if getArgs.StartLine != nil {
		lineRange = fmt.Sprintf("from line %d", *getArgs.StartLine)
	} else if getArgs.EndLine != nil {
		lineRange = fmt.Sprintf("to line %d", *getArgs.EndLine)
	}

	// TODO: This legacy function doesn't have access to ProjectService
	return fmt.Sprintf("[WARNING] read_file tool not properly initialized. Requested: %s (%s)", getArgs.Path, lineRange), "", nil
}
