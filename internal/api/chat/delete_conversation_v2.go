package chat

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServerV2) DeleteConversation(
	ctx context.Context,
	req *chatv2.DeleteConversationRequest,
) (*chatv2.DeleteConversationResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	objectID, err := bson.ObjectIDFromHex(req.GetConversationId())
	if err != nil {
		return nil, err
	}

	if err := s.chatServiceV2.DeleteConversationV2(ctx, actor.ID, objectID); err != nil {
		return nil, err
	}

	return &chatv2.DeleteConversationResponse{}, nil
}
