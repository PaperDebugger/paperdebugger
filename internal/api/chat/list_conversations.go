package chat

import (
	"context"

	"github.com/samber/lo"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/models"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

func (s *ChatServer) ListConversations(
	ctx context.Context,
	req *chatv1.ListConversationsRequest,
) (*chatv1.ListConversationsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	conversations, err := s.chatService.ListConversations(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		return nil, err
	}

	return &chatv1.ListConversationsResponse{
		Conversations: lo.Map(conversations, func(conversation *models.Conversation, _ int) *chatv1.Conversation {
			return mapper.MapModelConversationToProto(conversation)
		}),
	}, nil
}
