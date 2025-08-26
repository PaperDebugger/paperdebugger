package handler

import (
	"paperdebugger/internal/models"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2/responses"
)

type StreamHandler struct {
	callbackStream chatv1.ChatService_CreateConversationMessageStreamServer
	conversationId string
	languageModel  models.LanguageModel
}

func NewStreamHandler(
	callbackStream chatv1.ChatService_CreateConversationMessageStreamServer,
	conversationId string,
	languageModel models.LanguageModel,
) *StreamHandler {
	return &StreamHandler{
		callbackStream: callbackStream,
		conversationId: conversationId,
		languageModel:  languageModel,
	}
}

func (h *StreamHandler) SendInitialization() {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamInitialization{
			StreamInitialization: &chatv1.StreamInitialization{
				ConversationId: h.conversationId,
				LanguageModel:  chatv1.LanguageModel(h.languageModel),
			},
		},
	})
}

func (h *StreamHandler) HandleAddedItem(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	if chunk.Item.Type == "message" {
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv1.StreamPartBegin{
					MessageId: "openai_" + chunk.Item.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_Assistant{
							Assistant: &chatv1.MessageTypeAssistant{},
						},
					},
				},
			},
		})
	} else if chunk.Item.Type == "function_call" {
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv1.StreamPartBegin{
					MessageId: "openai_" + chunk.Item.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv1.MessageTypeToolCallPrepareArguments{
								Name: chunk.Item.Name,
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandler) HandleDoneItem(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	item := chunk.Item
	switch item.Type {
	case "message":
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv1.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_Assistant{
							Assistant: &chatv1.MessageTypeAssistant{
								Content: item.Content[0].Text,
							},
						},
					},
				},
			},
		})
	case "function_call":
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv1.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv1.MessageTypeToolCallPrepareArguments{
								Name: item.Name,
								Args: item.Arguments,
							},
						},
					},
				},
			},
		})
	default:
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv1.StreamPartEnd{
					MessageId: "openai_" + item.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_Unknown{
							Unknown: &chatv1.MessageTypeUnknown{
								Description: "Unknown message type: " + item.Type,
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandler) HandleTextDelta(chunk responses.ResponseStreamEventUnion) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_MessageChunk{
			MessageChunk: &chatv1.MessageChunk{
				MessageId: "openai_" + chunk.ItemID,
				Delta:     chunk.Delta,
			},
		},
	})
}

func (h *StreamHandler) SendIncompleteIndicator(reason string, responseId string) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_IncompleteIndicator{
			IncompleteIndicator: &chatv1.IncompleteIndicator{
				Reason:     reason,
				ResponseId: responseId,
			},
		},
	})
}

func (h *StreamHandler) SendFinalization() {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamFinalization{
			StreamFinalization: &chatv1.StreamFinalization{
				ConversationId: h.conversationId,
			},
		},
	})
}

func (h *StreamHandler) SendToolCallBegin(toolCall responses.ResponseFunctionToolCall) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
			StreamPartBegin: &chatv1.StreamPartBegin{
				MessageId: "openai_" + toolCall.CallID,
				Payload: &chatv1.MessagePayload{
					MessageType: &chatv1.MessagePayload_ToolCall{
						ToolCall: &chatv1.MessageTypeToolCall{
							Name: toolCall.Name,
							Args: toolCall.Arguments,
						},
					},
				},
			},
		},
	})
}

func (h *StreamHandler) SendToolCallEnd(toolCall responses.ResponseFunctionToolCall, result string, err error) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv1.StreamPartEnd{
				MessageId: "openai_" + toolCall.CallID,
				Payload: &chatv1.MessagePayload{
					MessageType: &chatv1.MessagePayload_ToolCall{
						ToolCall: &chatv1.MessageTypeToolCall{
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
