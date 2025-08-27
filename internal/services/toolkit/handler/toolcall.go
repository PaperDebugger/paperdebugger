package handler

import (
	"context"
	"paperdebugger/internal/services/toolkit/registry"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2/responses"
)

const (
	messageTypeFunctionCall = "function_call"
	messageTypeMessage      = "message"
	roleAssistant           = "assistant"
)

// ToolCallHandler is responsible for handling tool calls by dispatching them to the appropriate tool registry
// and managing the chat history for both OpenAI and in-app chat systems.
type ToolCallHandler struct {
	Registry *registry.ToolRegistry // Registry containing available tools for function calls
}

func NewToolCallHandler(toolRegistry *registry.ToolRegistry) *ToolCallHandler {
	return &ToolCallHandler{
		Registry: toolRegistry,
	}
}

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
//   - inappChatHistory:  The in-app chat history as a slice of chatv1.Message, reflecting tool call events.
//   - error:             Any error encountered during processing (always nil in current implementation).
func (h *ToolCallHandler) HandleToolCalls(ctx context.Context, outputs []responses.ResponseOutputItemUnion, streamHandler *StreamHandler) (responses.ResponseNewParamsInputUnion, []chatv1.Message, error) {
	openaiChatHistory := responses.ResponseNewParamsInputUnion{} // Accumulates OpenAI chat history items
	inappChatHistory := []chatv1.Message{}                       // Accumulates in-app chat history messages

	// Iterate over each output item to process tool calls
	for _, output := range outputs {
		if output.Type == messageTypeFunctionCall {
			toolCall := output.AsFunctionCall()

			// According to OpenAI, function_call and function_call_output must appear in pairs in the chat history.
			// Add the function call to the OpenAI chat history.
			openaiChatHistory.OfInputItemList = append(openaiChatHistory.OfInputItemList, responses.ResponseInputItemParamOfFunctionCall(
				toolCall.Arguments,
				toolCall.CallID,
				toolCall.Name,
			))

			// Notify the stream handler that a tool call is beginning.
			if streamHandler != nil {
				streamHandler.SendToolCallBegin(toolCall)
			}
			result, err := h.Registry.Call(ctx, toolCall.CallID, toolCall.Name, []byte(toolCall.Arguments))
			if streamHandler != nil {
				streamHandler.SendToolCallEnd(toolCall, result, err)
			}

			if err != nil {
				// If there was an error, append an error output to OpenAI chat history and in-app chat history.
				openaiChatHistory.OfInputItemList = append(openaiChatHistory.OfInputItemList, responses.ResponseInputItemParamOfFunctionCallOutput(toolCall.CallID, "Error: "+err.Error()))
				inappChatHistory = append(inappChatHistory, chatv1.Message{
					MessageId: "openai_" + toolCall.CallID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCall{
							ToolCall: &chatv1.MessageTypeToolCall{
								Name:  toolCall.Name,
								Args:  toolCall.Arguments,
								Error: err.Error(),
							},
						},
					},
				})
			} else {
				// On success, append the result to both OpenAI and in-app chat histories.
				openaiChatHistory.OfInputItemList = append(openaiChatHistory.OfInputItemList, responses.ResponseInputItemParamOfFunctionCallOutput(toolCall.CallID, result))
				inappChatHistory = append(inappChatHistory, chatv1.Message{
					MessageId: "openai_" + toolCall.CallID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCall{
							ToolCall: &chatv1.MessageTypeToolCall{
								Name:   toolCall.Name,
								Args:   toolCall.Arguments,
								Result: result,
							},
						},
					},
				})
			}
		}
	}

	// Return both chat histories and nil error (no error aggregation in this implementation)
	return openaiChatHistory, inappChatHistory, nil
}
