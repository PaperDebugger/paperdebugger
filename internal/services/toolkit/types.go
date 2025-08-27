package toolkit

import (
	"context"
	"encoding/json"
)

type ToolHandler func(ctx context.Context, toolCallId string, args json.RawMessage) (result string, furtherInstruction string, err error)

type ToolRegistry interface {
	Register(name string, handler ToolHandler)
	Call(ctx context.Context, toolCallId string, toolCallName string, toolCallArgs json.RawMessage) (result string, furtherInstruction string, err error)
}
