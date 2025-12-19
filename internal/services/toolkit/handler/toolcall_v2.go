package handler

import (
	"context"
	"fmt"
	"paperdebugger/internal/services/toolkit/registry"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
	"time"

	"github.com/openai/openai-go/v3"
)

// ToolCallHandler is responsible for handling tool calls by dispatching them to the appropriate tool registry
// and managing the chat history for both OpenAI and in-app chat systems.
type ToolCallHandlerV2 struct {
	Registry *registry.ToolRegistryV2 // Registry containing available tools for function calls
}

func NewToolCallHandlerV2(toolRegistry *registry.ToolRegistryV2) *ToolCallHandlerV2 {
	return &ToolCallHandlerV2{
		Registry: toolRegistry,
	}
}

type OpenAIChatHistory []openai.ChatCompletionMessageParamUnion
type AppChatHistory []chatv2.Message

// HandleToolCalls processes a list of tool call outputs, invokes the corresponding tools, and constructs
// both OpenAI and in-app chat histories reflecting the tool call and its result.
//
// Parameters:
// ctx:           The context for cancellation and deadlines.
// outputs:       A slice of ResponseOutputItemUnion representing outputs from the model, possibly containing tool calls.
// streamHandler: Optional handler for streaming tool call events (can be nil).
//
// Returns:
//   - openaiChatHistory: The OpenAI-compatible chat history including tool call and output items.
//   - inappChatHistory:  The in-app chat history as a slice of chatv2.Message, reflecting tool call events.
//   - error:             Any error encountered during processing (always nil in current implementation).
func (h *ToolCallHandlerV2) HandleToolCallsV2(ctx context.Context, toolCalls []openai.FinishedChatCompletionToolCall, streamHandler *StreamHandlerV2) (OpenAIChatHistory, AppChatHistory, error) {
	if len(toolCalls) == 0 {
		return nil, nil, nil
	}

	openaiChatHistory := []openai.ChatCompletionMessageParamUnion{} // Accumulates OpenAI chat history items
	inappChatHistory := []chatv2.Message{}                          // Accumulates in-app chat history messages

	toolCallsParam := make([]openai.ChatCompletionMessageToolCallUnionParam, len(toolCalls))
	for i, toolCall := range toolCalls {
		toolCallsParam[i] = openai.ChatCompletionMessageToolCallUnionParam{
			OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
				ID:   toolCall.ID,
				Type: "function",
				Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
					Name:      toolCall.Name,
					Arguments: toolCall.Arguments,
				},
			},
		}
	}

	openaiChatHistory = append(openaiChatHistory, openai.ChatCompletionMessageParamUnion{
		OfAssistant: &openai.ChatCompletionAssistantMessageParam{
			ToolCalls: toolCallsParam,
		},
	})

	// Iterate over each output item to process tool calls
	for _, toolCall := range toolCalls {
		if streamHandler != nil {
			streamHandler.SendToolCallBegin(toolCall)
		}

		toolResult, err := h.Registry.Call(ctx, toolCall.ID, toolCall.Name, []byte(toolCall.Arguments))

		if streamHandler != nil {
			streamHandler.SendToolCallEnd(toolCall, toolResult, err)
		}

		resultStr := toolResult
		if err != nil {
			resultStr = "Error: " + err.Error()
		}

		openaiChatHistory = append(openaiChatHistory, openai.ChatCompletionMessageParamUnion{
			OfTool: &openai.ChatCompletionToolMessageParam{
				Role:       "tool",
				ToolCallID: toolCall.ID,
				Content: openai.ChatCompletionToolMessageParamContentUnion{
					OfArrayOfContentParts: []openai.ChatCompletionContentPartTextParam{
						{
							Type: "text",
							Text: resultStr,
						},
						// {
						// 	Type:     "image_url",
						// 	ImageURL: "xxx"
						// },
					},
				},
			},
		})

		toolCallMsg := &chatv2.MessageTypeToolCall{
			Name: toolCall.Name,
			Args: toolCall.Arguments,
		}
		if err != nil {
			toolCallMsg.Error = err.Error()
		} else {
			toolCallMsg.Result = resultStr
		}

		inappChatHistory = append(inappChatHistory, chatv2.Message{
			MessageId: fmt.Sprintf("openai_toolCall[%d]_%s", toolCall.Index, toolCall.ID),
			Payload: &chatv2.MessagePayload{
				MessageType: &chatv2.MessagePayload_ToolCall{
					ToolCall: toolCallMsg,
				},
			},
			Timestamp: time.Now().Unix(),
		})
	}

	// Return both chat histories and nil error (no error aggregation in this implementation)
	return openaiChatHistory, inappChatHistory, nil
}
