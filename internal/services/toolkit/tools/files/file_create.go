package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var CreateFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "create_file",
			Description: param.NewOpt("Creates a new file at the specified path with the given content. Returns an error if the file already exists."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path where the file should be created.",
					},
					"content": map[string]any{
						"type":        "string",
						"description": "The content to write to the file.",
					},
				},
				"required": []string{"path", "content"},
			},
		},
	},
}

type CreateFileArgs struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func CreateFileTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs CreateFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual file creation logic
	return "", "", fmt.Errorf("create_file tool is not yet implemented: cannot create file at %s", getArgs.Path)
}
