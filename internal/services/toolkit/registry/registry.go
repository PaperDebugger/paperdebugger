package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v2/responses"
	"github.com/samber/lo"
)

type ToolRegistry struct {
	tools       map[string]toolkit.ToolHandler
	description map[string]responses.ToolUnionParam
}

func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools:       make(map[string]toolkit.ToolHandler),
		description: make(map[string]responses.ToolUnionParam),
	}
}

func (r *ToolRegistry) Register(name string, description responses.ToolUnionParam, handler toolkit.ToolHandler) {
	r.tools[name] = handler
	r.description[name] = description
}

func (r *ToolRegistry) Call(ctx context.Context, toolCallId string, toolCallName string, toolCallArgs json.RawMessage) (result string, err error) {
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

func (r *ToolRegistry) GetTools() []responses.ToolUnionParam {
	return lo.Values(r.description)
}
