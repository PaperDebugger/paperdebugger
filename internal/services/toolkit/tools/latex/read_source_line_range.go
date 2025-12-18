package latex

import (
	"context"
	"encoding/json"
	"fmt"

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

func ReadSourceLineRangeTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSourceLineRangeArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual line range reading logic
	return fmt.Sprintf(`[DUMMY] Reading file '%s' lines %d-%d:
Line %d: \begin{document}
Line %d: This is placeholder content.
Line %d: \end{document}`,
		getArgs.FilePath, getArgs.StartLine, getArgs.EndLine,
		getArgs.StartLine, (getArgs.StartLine+getArgs.EndLine)/2, getArgs.EndLine), "", nil
}
