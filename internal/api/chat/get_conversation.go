package chat

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

func (s *ChatServer) GetConversation(
	ctx context.Context,
	req *chatv1.GetConversationRequest,
) (*chatv1.GetConversationResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	conversationID, err := bson.ObjectIDFromHex(req.GetConversationId())
	if err != nil {
		return nil, err
	}

	conversation, err := s.chatService.GetConversation(ctx, actor.ID, conversationID)
	if err != nil {
		return nil, err
	}

	return &chatv1.GetConversationResponse{
		Conversation: mapper.MapModelConversationToProto(conversation),
	}, nil
}
