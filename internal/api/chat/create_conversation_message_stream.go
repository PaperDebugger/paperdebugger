package chat

import (
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServer) sendStreamError(stream chatv1.ChatService_CreateConversationMessageStreamServer, err error) error {
	return stream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamError{
			StreamError: &chatv1.StreamError{
				ErrorMessage: err.Error(),
			},
		},
	})
}

func (s *ChatServer) CreateConversationMessageStream(
	req *chatv1.CreateConversationMessageStreamRequest,
	stream chatv1.ChatService_CreateConversationMessageStreamServer,
) error {
	ctx := stream.Context()
	ctx, conversation, err := s.prepare(
		ctx,
		req.GetProjectId(),
		req.GetConversationId(),
		req.GetUserMessage(),
		req.GetUserSelectedText(),
		models.LanguageModel(req.GetLanguageModel()),
		req.GetConversationType(),
	)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// Same usage as ChatCompletion, but with a stream parameter
	openaiChatHistory, inappChatHistory, err := s.aiClient.ChatCompletionStream(ctx, stream, conversation.ID.Hex(), conversation.LanguageModel, conversation.OpenaiChatHistory)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// Append messages to the conversation
	bsonMessages := make([]bson.M, len(inappChatHistory))
	for i := range inappChatHistory {
		bsonMsg, err := convertToBSON(&inappChatHistory[i])
		if err != nil {
			return s.sendStreamError(stream, err)
		}
		bsonMessages[i] = bsonMsg
	}
	conversation.InappChatHistory = append(conversation.InappChatHistory, bsonMessages...)
	conversation.OpenaiChatHistory = openaiChatHistory
	if err := s.chatService.UpdateConversation(ctx, conversation); err != nil {
		return s.sendStreamError(stream, err)
	}

	if conversation.Title == services.DefaultConversationTitle {
		go func() {
			protoMessages := make([]*chatv1.Message, len(conversation.InappChatHistory))
			for i, bsonMsg := range conversation.InappChatHistory {
				protoMessages[i] = mapper.BSONToChatMessage(bsonMsg)
			}
			title, err := s.aiClient.GetConversationTitle(ctx, protoMessages)
			if err != nil {
				s.logger.Error("Failed to get conversation title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
			conversation.Title = title
			if err := s.chatService.UpdateConversation(ctx, conversation); err != nil {
				s.logger.Error("Failed to update conversation with new title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
		}()
	}

	// The final conversation object is NOT returned
	return nil
}
