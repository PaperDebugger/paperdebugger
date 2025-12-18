package latex

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var ReadSectionSourceToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "read_section_source",
			Description: param.NewOpt("读取特定章节的完整 LaTeX 源码。Reads the complete LaTeX source code of a specific section by its title."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]any{
						"type":        "string",
						"description": "The title of the section to read (e.g., 'Introduction', 'Methodology').",
					},
				},
				"required": []string{"title"},
			},
		},
	},
}

type ReadSectionSourceArgs struct {
	Title string `json:"title"`
}

func ReadSectionSourceTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSectionSourceArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual section source reading logic
	return fmt.Sprintf(`[DUMMY] LaTeX source for section '%s':
\section{%s}
This is a placeholder for the actual LaTeX content of the section.
The real implementation will return the complete source code.`, getArgs.Title, getArgs.Title), "", nil
}
