package tools

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/openai/openai-go/v2/packages/param"
	"github.com/openai/openai-go/v2/responses"
)

var AlwaysExceptionToolDescription = responses.ToolUnionParam{
	OfFunction: &responses.FunctionToolParam{
		Name:        "always_exception",
		Description: param.NewOpt("This function is used to test the exception handling of the LLM. It always throw an exception. Please do not use this function unless user explicitly ask for it."),
	},
}

func AlwaysExceptionTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	return "", "", errors.New("Because [Alex] didn't tighten the faucet, the [pipe] suddenly started leaking, causing the [kitchen] in chaos, [MacBook Pro] to short-circuit")
}
