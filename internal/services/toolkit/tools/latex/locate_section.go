package latex

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var LocateSectionToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "locate_section",
			Description: param.NewOpt("Locates a specific section by its title and returns the exact position (file path + line number range). Locates a specific section by its title and returns the file path and line number range."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]any{
						"type":        "string",
						"description": "The title of the section to locate (e.g., 'Introduction', 'Related Work').",
					},
				},
				"required": []string{"title"},
			},
		},
	},
}

type LocateSectionArgs struct {
	Title string `json:"title"`
}

func LocateSectionTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs LocateSectionArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual section location logic
	return fmt.Sprintf(`[DUMMY] Located section '%s':
File: main.tex
Start Line: 42
End Line: 87`, getArgs.Title), "", nil
}
