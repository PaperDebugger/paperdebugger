package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var CreateFolderToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "create_folder",
			Description: param.NewOpt("Creates a new folder (directory) at the specified path. Creates parent directories if they don't exist (like mkdir -p)."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path where the folder should be created.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type CreateFolderArgs struct {
	Path string `json:"path"`
}

func CreateFolderTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs CreateFolderArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual folder creation logic
	return fmt.Sprintf("[DUMMY] Folder created at: %s", getArgs.Path), "", nil
}
