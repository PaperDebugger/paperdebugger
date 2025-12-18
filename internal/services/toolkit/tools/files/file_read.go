package tools

import (
	"context"
	"encoding/json"
	"fmt"

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

func ReadFileTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
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

	// TODO: Implement actual file reading logic
	return fmt.Sprintf("[DUMMY] Read file: %s (%s)", getArgs.Path, lineRange), "", nil
}
