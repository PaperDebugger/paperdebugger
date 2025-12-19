package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var DeleteFolderToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "delete_folder",
			Description: param.NewOpt("Deletes a folder (directory) at the specified path. Can optionally delete recursively including all contents."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path of the folder to delete.",
					},
					"recursive": map[string]any{
						"type":        "boolean",
						"description": "If true, delete the folder and all its contents recursively. Default is false.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type DeleteFolderArgs struct {
	Path      string `json:"path"`
	Recursive *bool  `json:"recursive,omitempty"`
}

func DeleteFolderTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs DeleteFolderArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	recursive := false
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
	}

	// TODO: Implement actual folder deletion logic
	return fmt.Sprintf("[DUMMY] Folder deleted: %s (recursive: %v)", getArgs.Path, recursive), "", nil
}
