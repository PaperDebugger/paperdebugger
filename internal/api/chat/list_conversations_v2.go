package chat

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/models"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/samber/lo"
)

func (s *ChatServerV2) ListConversations(
	ctx context.Context,
	req *chatv2.ListConversationsRequest,
) (*chatv2.ListConversationsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	conversations, err := s.chatServiceV2.ListConversationsV2(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		return nil, err
	}

	return &chatv2.ListConversationsResponse{
		Conversations: lo.Map(conversations, func(conversation *models.Conversation, _ int) *chatv2.Conversation {
			return mapper.MapModelConversationToProtoV2(conversation)
		}),
	}, nil
}
