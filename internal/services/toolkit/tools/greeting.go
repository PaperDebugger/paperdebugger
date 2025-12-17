package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var GreetingToolDescription = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "greeting",
			Description: param.NewOpt("This tool is used to greet the user. It is a demo tool. Please do not use this tool unless user explicitly ask for it. If you think you need to use this tool, please ask the user's name first."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]any{
						"type":        "string",
						"description": "The name of the user, must ask user's name first if you want to use this tool.",
					},
				},
				"required": []string{"name"},
			},
		},
	},
}

func GreetingTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs struct {
		Name string `json:"name"`
	}

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}
	return fmt.Sprintf("Welcome to PaperDebugger, %s!", getArgs.Name), "", nil
}
