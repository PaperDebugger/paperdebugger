package handler

import (
	"fmt"
	"paperdebugger/internal/models"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v3"
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

func (h *StreamHandler) HandleAddedItem(chunk openai.ChatCompletionChunk) {
	if h.callbackStream == nil {
		return
	}
	switch chunk.Choices[0].Delta.Role {
	case "assistant":
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv1.StreamPartBegin{
					MessageId: "openai_" + chunk.ID,
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_Assistant{
							Assistant: &chatv1.MessageTypeAssistant{},
						},
					},
				},
			},
		})
		// default:
		// 	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		// 		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
		// 			StreamPartBegin: &chatv1.StreamPartBegin{
		// 				MessageId: "openai_" + chunk.ID,
		// 				Payload: &chatv1.MessagePayload{
		// 					MessageType: &chatv1.MessagePayload_Unknown{
		// 						Unknown: &chatv1.MessageTypeUnknown{
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
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv1.StreamPartBegin{
					MessageId: fmt.Sprintf("openai_toolCallPrepareArguments[%d]_%s", toolCall.Index, toolCall.ID),
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv1.MessageTypeToolCallPrepareArguments{
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

func (h *StreamHandler) HandleTextDoneItem(chunk openai.ChatCompletionChunk, content string) {
	if h.callbackStream == nil {
		return
	}
	if chunk.Choices[0].Delta.Role != "" && chunk.Choices[0].Delta.Content != "" {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv1.StreamPartEnd{
				MessageId: "openai_" + chunk.ID,
				Payload: &chatv1.MessagePayload{
					MessageType: &chatv1.MessagePayload_Assistant{
						Assistant: &chatv1.MessageTypeAssistant{
							Content: content,
						},
					},
				},
			},
		},
	})
}

func (h *StreamHandler) HandleToolArgPreparedDoneItem(chunk openai.ChatCompletionChunk, toolCalls []openai.FinishedChatCompletionToolCall) {
	if h.callbackStream == nil {
		return
	}
	if chunk.Choices[0].Delta.Role != "" && chunk.Choices[0].Delta.Content != "" {
		return
	}
	for _, toolCall := range toolCalls { // Supports parallel tool calls
		h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
				StreamPartEnd: &chatv1.StreamPartEnd{
					MessageId: fmt.Sprintf("openai_toolCallPrepareArguments[%d]_%s", toolCall.Index, toolCall.ID),
					Payload: &chatv1.MessagePayload{
						MessageType: &chatv1.MessagePayload_ToolCallPrepareArguments{
							ToolCallPrepareArguments: &chatv1.MessageTypeToolCallPrepareArguments{
								Name: toolCall.Name,
								Args: toolCall.Arguments,
							},
						},
					},
				},
			},
		})
	}
}

func (h *StreamHandler) HandleTextDelta(chunk openai.ChatCompletionChunk) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_MessageChunk{
			MessageChunk: &chatv1.MessageChunk{
				MessageId: "openai_" + chunk.ID,
				Delta:     chunk.Choices[0].Delta.Content,
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

func (h *StreamHandler) SendToolCallBegin(toolCall openai.FinishedChatCompletionToolCall) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartBegin{
			StreamPartBegin: &chatv1.StreamPartBegin{
				MessageId: fmt.Sprintf("openai_tool[%d]_%s", toolCall.Index, toolCall.ID),
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

func (h *StreamHandler) SendToolCallEnd(toolCall openai.FinishedChatCompletionToolCall, result string, err error) {
	if h.callbackStream == nil {
		return
	}
	h.callbackStream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv1.StreamPartEnd{
				MessageId: fmt.Sprintf("openai_tool[%d]_%s", toolCall.Index, toolCall.ID),
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
