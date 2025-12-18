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

func (h *StreamHandlerV2) HandleAddedItem(chunk openai.ChatCompletionChunk) {
	if h.callbackStream == nil {
		return
	}
	switch chunk.Choices[0].Delta.Role {
	case "assistant":
		h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
			ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartBegin{
				StreamPartBegin: &chatv2.StreamPartBegin{
					MessageId: "openai_" + chunk.ID,
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
		// 				MessageId: "openai_" + chunk.ID,
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
					MessageId: fmt.Sprintf("openai_toolCallPrepareArguments[%d]_%s", toolCall.Index, toolCall.ID),
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

func (h *StreamHandlerV2) HandleTextDoneItem(chunk openai.ChatCompletionChunk, content string) {
	if h.callbackStream == nil {
		return
	}
	if chunk.Choices[0].Delta.Role != "" {
		return
	}
	h.callbackStream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamPartEnd{
			StreamPartEnd: &chatv2.StreamPartEnd{
				MessageId: "openai_" + chunk.ID,
				Payload: &chatv2.MessagePayload{
					MessageType: &chatv2.MessagePayload_Assistant{
						Assistant: &chatv2.MessageTypeAssistant{
							Content:   content,
							ModelSlug: h.modelSlug,
						},
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
				MessageId: fmt.Sprintf("openai_toolCallPrepareArguments[%d]_%s", index, id),
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
				MessageId: "openai_" + chunk.ID,
				Delta:     chunk.Choices[0].Delta.Content,
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
				MessageId: fmt.Sprintf("openai_tool[%d]_%s", toolCall.Index, toolCall.ID),
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
				MessageId: fmt.Sprintf("openai_tool[%d]_%s", toolCall.Index, toolCall.ID),
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
