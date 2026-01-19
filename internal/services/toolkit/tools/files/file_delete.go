package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var DeleteFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "delete_file",
			Description: param.NewOpt("Deletes a file at the specified path. Returns an error if the file does not exist or cannot be deleted."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path of the file to delete.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type DeleteFileArgs struct {
	Path string `json:"path"`
}

func DeleteFileTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs DeleteFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// TODO: Implement actual file deletion logic
	return "", "", fmt.Errorf("delete_file tool is not yet implemented: cannot delete file at %s", getArgs.Path)
}
