package chat

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *ChatServer) UpdateConversation(
	ctx context.Context,
	req *chatv1.UpdateConversationRequest,
) (*chatv1.UpdateConversationResponse, error) {
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

	if req.GetTitle() == "" {
		return nil, shared.ErrBadRequest("title is required")
	}

	conversation.Title = req.GetTitle()
	err = s.chatService.UpdateConversation(conversation)
	if err != nil {
		return nil, err
	}

	return &chatv1.UpdateConversationResponse{
		Conversation: mapper.MapModelConversationToProto(conversation),
	}, nil
}
