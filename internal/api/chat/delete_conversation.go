package chat

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"paperdebugger/internal/libs/contextutil"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

func (s *ChatServer) DeleteConversation(
	ctx context.Context,
	req *chatv1.DeleteConversationRequest,
) (*chatv1.DeleteConversationResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	conversationID, err := bson.ObjectIDFromHex(req.GetConversationId())
	if err != nil {
		return nil, err
	}

	err = s.chatService.DeleteConversation(ctx, actor.ID, conversationID)
	if err != nil {
		return nil, err
	}

	return &chatv1.DeleteConversationResponse{}, nil
}
