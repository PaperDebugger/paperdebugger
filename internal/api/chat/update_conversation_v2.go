package chat

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServerV2) UpdateConversation(
	ctx context.Context,
	req *chatv2.UpdateConversationRequest,
) (*chatv2.UpdateConversationResponse, error) {
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

	if req.GetTitle() == "" {
		return nil, shared.ErrBadRequest("title is required")
	}

	conversation.Title = req.GetTitle()
	err = s.chatServiceV2.UpdateConversationV2(conversation)
	if err != nil {
		return nil, err
	}

	return &chatv2.UpdateConversationResponse{
		Conversation: mapper.MapModelConversationToProtoV2(conversation),
	}, nil
}
