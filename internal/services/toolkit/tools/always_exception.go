package tools

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var AlwaysExceptionToolDescription = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "always_exception",
			Description: param.NewOpt("This function is used to test the exception handling of the LLM. It always throw an exception. Please do not use this function unless user explicitly ask for it."),
		},
	},
}

func AlwaysExceptionTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	return "", "", errors.New("because [Alex] didn't tighten the faucet, the [pipe] suddenly started leaking, causing the [kitchen] in chaos, [MacBook Pro] to short-circuit")
}
