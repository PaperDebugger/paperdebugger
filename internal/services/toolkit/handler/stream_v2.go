package handler

import (
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v2/responses"
)

// Compile-time check: ensure StreamHandlerV2 implements StreamHandler interface
var _ StreamHandler = (*StreamHandlerV2)(nil)

type StreamHandlerV2 struct {
	callbackStream chatv2.ChatService_CreateConversationMessageStreamServer
	conversationId string
	modelSlug      string
}

func NewStreamHandlerV2(
	callbackStream chatv2.ChatService_CreateConversationMessageStreamServer,
	conversationId string,
	modelSlug string,
) StreamHandler {
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

	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamInitialization{
			StreamInitialization: &chatv2.StreamInitialization{
				ConversationId: h.conversationId,
				ModelSlug:      h.modelSlug,
			},
		},
	})
}

func (h *StreamHandlerV2) HandleAddedItem(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	if chunk.Item.Type == "message" {
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv2.StreamPartBegin{
					MessageId: "openai_" + chunk.Item.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_Assistant{
							Assistant: &chatv2.MessageTypeAssistant{
								ModelSlug: h.modelSlug,
							},
						},
					},
				},
			},
		})
	} else if chunk.Item.Type == "function_call" {
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv2.StreamPartBegin{
					MessageId: "openai_" + chunk.Item.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv2.MessageTypeToolCallPrepareArguments{
								Name: chunk.Item.Name,
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandlerV2) HandleDoneItem(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	item := chunk.Item
	switch item.Type {
	case "message":
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv2.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_Assistant{
							Assistant: &chatv2.MessageTypeAssistant{
								Content:   item.Content[0].Text,
								ModelSlug: h.modelSlug,
							},
						},
					},
				},
			},
		})
	case "function_call":
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv2.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv2.MessageTypeToolCallPrepareArguments{
								Name: item.Name,
								Args: item.Arguments,
							},
						},
					},
				},
			},
		})
	default:
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv2.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv2.MessagePayload{
						MessageType: &chatv2.MessagePayload_Unknown{
							Unknown: &chatv2.MessageTypeUnknown{
								Description: "Unknown message type: " + item.Type,
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandlerV2) HandleTextDelta(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_MessageChunk{
			MessageChunk: &chatv2.MessageChunk{
				MessageId: "openai_" + chunk.ItemID,
				Delta:     chunk.Delta,
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

func (h *StreamHandlerV2) SendToolCallBegin(toolCall responses.ResponseFunctionToolCall) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
			StreamPartBegin: &chatv2.StreamPartBegin{
				MessageId: "openai_" + toolCall.CallID,
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

func (h *StreamHandlerV2) SendToolCallEnd(toolCall responses.ResponseFunctionToolCall, result string, err error) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv2.StreamPartEnd{
				MessageId: "openai_" + toolCall.CallID,
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
