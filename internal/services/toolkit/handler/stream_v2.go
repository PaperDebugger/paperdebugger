package handler

import (
	"fmt"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v3"
)

type StreamHandlerV2 struct {
	callbackStream chatv2.ChatService_CreateConversationMessageStreamServer
	conversationId string
	modelSlug      string
}

func NewStreamHandlerV2(
	callbackStream chatv2.ChatService_CreateConversationMessageStreamServer,
	conversationId string,
	modelSlug string,
) *StreamHandlerV2 {
	return &StreamHandlerV2{
		callbackStream: callbackStream,
		conversationId: conversationId,
		modelSlug:      modelSlug,
	}
}

func (h *StreamHandlerV2) SendInitialization() {
	if h.callbackStream == nil {
		return
	}
	streamInit := &chatv2.StreamInitialization{
		ConversationId: h.conversationId,
		ModelSlug:      h.modelSlug,
	}

	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamInitialization{
			StreamInitialization: streamInit,
		},
	})
}

// HandleAssistantPartBegin sends a StreamPartBegin message for an assistant message.
// Unlike HandleAddedItem, this doesn't check the delta.Role field, which is important
// because reasoning models may send reasoning_content before the role field is set.
func (h *StreamHandlerV2) HandleAssistantPartBegin(messageId string) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
			StreamPartBegin: &chatv2.StreamPartBegin{
				MessageId: messageId,
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_Assistant{
						Assistant: &chatv2.MessageTypeAssistant{},
					},
				},
			},
		},
	})
}

func (h *StreamHandlerV2) HandleAddedItem(chunk openai.ChatCompletionChunk) {
	if h.callbackStream == nil {
		return
	}
	switch chunk.Choices[0].Delta.Role {
	case "assistant":
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv2.StreamPartBegin{
					MessageId: chunk.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_Assistant{
							Assistant: &chatv2.MessageTypeAssistant{},
						},
					},
				},
			},
		})
		// default:
		// 	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		// 		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
		// 			StreamPartBegin: &chatv2.StreamPartBegin{
		// 				MessageId: chunk.ID,
		// 				Payload: &chatv2.MessagePayload{
		// 					MessageType: &chatv2.MessagePayload_Unknown{
		// 						Unknown: &chatv2.MessageTypeUnknown{
		// 							Description: fmt.Sprintf("%v", chunk.Choices[0].Delta.Role),
		// 						},
		// 					},
		// 				},
		// 			},
		// 		},
		// 	})
	}
	toolCalls := chunk.Choices[0].Delta.ToolCalls
	for _, toolCall := range toolCalls {
		if toolCall.Function.Name == "" {
			continue
		}
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv2.StreamPartBegin{
					MessageId: fmt.Sprintf("toolCallPrepareArguments[%d]_%s", toolCall.Index, toolCall.ID),
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv2.MessageTypeToolCallPrepareArguments{
								Name: toolCall.Function.Name,
								Args: "",
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandlerV2) HandleTextDoneItem(chunk openai.ChatCompletionChunk, content string, reasoning string) {
	if h.callbackStream == nil {
		return
	}

	assistant := &chatv2.MessageTypeAssistant{
		Content:   content,
		ModelSlug: h.modelSlug,
	}

	// Only send Reasoning if it's not empty
	if reasoning != "" {
		assistant.Reasoning = &reasoning
	}

	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv2.StreamPartEnd{
				MessageId: chunk.ID,
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_Assistant{
						Assistant: assistant,
					},
				},
			},
		},
	})
}

func (h *StreamHandlerV2) HandleToolArgPreparedDoneItem(index int, id string, name string, args string) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv2.StreamPartEnd{
				MessageId: fmt.Sprintf("toolCallPrepareArguments[%d]_%s", index, id),
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_ToolCallPrepareArguments{
						ToolCallPrepareArguments: &chatv2.MessageTypeToolCallPrepareArguments{
							Name: name,
							Args: args,
						},
					},
				},
			},
		},
	})
}

func (h *StreamHandlerV2) HandleTextDelta(chunk openai.ChatCompletionChunk) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_MessageChunk{
			MessageChunk: &chatv2.MessageChunk{
				MessageId: chunk.ID,
				Delta:     chunk.Choices[0].Delta.Content,
			},
		},
	})
}

func (h *StreamHandlerV2) HandleReasoningDelta(messageId string, delta string) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_ReasoningChunk{
			ReasoningChunk: &chatv2.ReasoningChunk{
				MessageId: messageId,
				Delta:     delta,
			},
		},
	})
}

func (h *StreamHandlerV2) SendIncompleteIndicator(reason string, responseId string) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_IncompleteIndicator{
			IncompleteIndicator: &chatv2.IncompleteIndicator{
				Reason:     reason,
				ResponseId: responseId,
			},
		},
	})
}

func (h *StreamHandlerV2) SendFinalization() {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamFinalization{
			StreamFinalization: &chatv2.StreamFinalization{
				ConversationId: h.conversationId,
			},
		},
	})
}

func (h *StreamHandlerV2) SendToolCallBegin(toolCall openai.FinishedChatCompletionToolCall) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
			StreamPartBegin: &chatv2.StreamPartBegin{
				MessageId: fmt.Sprintf("tool[%d]_%s", toolCall.Index, toolCall.ID),
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_ToolCall{
						ToolCall: &chatv2.MessageTypeToolCall{
							Name: toolCall.Name,
							Args: toolCall.Arguments,
						},
					},
				},
			},
		},
	})
}

func (h *StreamHandlerV2) SendToolCallEnd(toolCall openai.FinishedChatCompletionToolCall, result string, err error) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv2.StreamPartEnd{
				MessageId: fmt.Sprintf("tool[%d]_%s", toolCall.Index, toolCall.ID),
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_ToolCall{
						ToolCall: &chatv2.MessageTypeToolCall{
							Name:   toolCall.Name,
							Args:   toolCall.Arguments,
							Result: result,
							Error: func() string {
								if err != nil {
									return err.Error()
								}
								return ""
							}(),
						},
					},
				},
			},
		},
	})
}
