package chat

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServerV2) GetConversation(
	ctx context.Context,
	req *chatv2.GetConversationRequest,
) (*chatv2.GetConversationResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	conversationID, err := bson.ObjectIDFromHex(req.GetConversationId())
	if err != nil {
		return nil, err
	}

	conversation, err := s.chatServiceV2.GetConversationV2(ctx, actor.ID, conversationID)
	if err != nil {
		return nil, err
	}

	return &chatv2.GetConversationResponse{
		Conversation: mapper.MapModelConversationToProtoV2(conversation),
	}, nil
}
