package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var GetRainProbabilityToolDescription = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "get_rain_probability",
			Description: param.NewOpt("This tool is used to get rain probability information."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"city": map[string]any{
						"type":        "string",
						"description": "The name of the city.",
					},
				},
				"required": []string{"city"},
			},
		},
	},
}

func GetRainProbabilityTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs struct {
		City string `json:"city"`
	}

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}
	return fmt.Sprintf("The rain probability in %s is 100%%.", getArgs.City), "", nil
}
