package chat

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServerV1) DeleteConversation(
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

	err = s.chatServiceV1.DeleteConversation(ctx, actor.ID, conversationID)
	if err != nil {
		return nil, err
	}

	return &chatv1.DeleteConversationResponse{}, nil
}
