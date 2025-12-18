package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/samber/lo"
)

type ToolRegistryV2 struct {
	tools       map[string]toolkit.ToolHandler
	description map[string]openai.ChatCompletionToolUnionParam
}

func NewToolRegistryV2() *ToolRegistryV2 {
	return &ToolRegistryV2{
		tools:       make(map[string]toolkit.ToolHandler),
		description: make(map[string]openai.ChatCompletionToolUnionParam),
	}
}

func (r *ToolRegistryV2) Register(name string, description openai.ChatCompletionToolUnionParam, handler toolkit.ToolHandler) {
	r.tools[name] = handler
	r.description[name] = description
}

func (r *ToolRegistryV2) Call(ctx context.Context, toolCallId string, toolCallName string, toolCallArgs json.RawMessage) (result string, err error) {
	handler, ok := r.tools[toolCallName]
	if !ok {
		return "", fmt.Errorf("unknown tool: %s", toolCallName)
	}
	result, furtherInstruction, err := handler(ctx, toolCallId, toolCallArgs)
	if err != nil {
		return result, err
	}

	if furtherInstruction == "" {
		return result, nil
	} else {
		return fmt.Sprintf(`<RESULT>%s</RESULT>\n<INSTRUCTION>%s</INSTRUCTION>`, result, furtherInstruction), nil
	}
}

func (r *ToolRegistryV2) GetTools() []openai.ChatCompletionToolUnionParam {
	return lo.Values(r.description)
}
