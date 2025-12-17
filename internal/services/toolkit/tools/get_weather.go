package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var GetWeatherToolDescription = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "get_weather",
			Description: param.NewOpt("This tool is used to get weather information."),
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

func GetWeatherTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs struct {
		City string `json:"city"`
	}

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}
	// sleep 10s
	time.Sleep(10 * time.Second)
	return fmt.Sprintf("The weather in %s is sunny.", getArgs.City), "", nil
}
