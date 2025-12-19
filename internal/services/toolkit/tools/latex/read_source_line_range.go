package latex

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

var ReadSourceLineRangeToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "read_source_line_range",
			Description: param.NewOpt("(Fallback) Reads the source code from a specific file within a given line range."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"file_path": map[string]any{
						"type":        "string",
						"description": "The path to the LaTeX file to read from.",
					},
					"start_line": map[string]any{
						"type":        "integer",
						"description": "The starting line number (1-indexed).",
					},
					"end_line": map[string]any{
						"type":        "integer",
						"description": "The ending line number (1-indexed, inclusive).",
					},
				},
				"required": []string{"file_path", "start_line", "end_line"},
			},
		},
	},
}

type ReadSourceLineRangeArgs struct {
	FilePath  string `json:"file_path"`
	StartLine int    `json:"start_line"`
	EndLine   int    `json:"end_line"`
}

type ReadSourceLineRangeTool struct {
	projectService *services.ProjectService
}

func NewReadSourceLineRangeTool(projectService *services.ProjectService) *ReadSourceLineRangeTool {
	return &ReadSourceLineRangeTool{
		projectService: projectService,
	}
}

func (t *ReadSourceLineRangeTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSourceLineRangeArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Validate line range
	if getArgs.StartLine < 1 {
		return "start_line must be at least 1", "", nil
	}
	if getArgs.EndLine < getArgs.StartLine {
		return "end_line must be greater than or equal to start_line", "", nil
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
	targetPath := normalizePath(getArgs.FilePath)

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
		return fmt.Sprintf("File not found: %s", getArgs.FilePath), "", nil
	}

	lines := foundDoc.Lines
	totalLines := len(lines)

	// Convert to 0-indexed
	startIdx := getArgs.StartLine - 1
	endIdx := getArgs.EndLine

	// Clamp to valid range
	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx >= totalLines {
		return fmt.Sprintf("start_line %d is beyond file length (%d lines)", getArgs.StartLine, totalLines), "", nil
	}
	if endIdx > totalLines {
		endIdx = totalLines
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

// ReadSourceLineRangeToolLegacy for backward compatibility (standalone function)
func ReadSourceLineRangeToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSourceLineRangeArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	return fmt.Sprintf(`[WARNING] read_source_line_range tool not properly initialized. Requested: file '%s' lines %d-%d`,
		getArgs.FilePath, getArgs.StartLine, getArgs.EndLine), "", nil
}
