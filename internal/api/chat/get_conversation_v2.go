package chat

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
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

	// Migrate legacy data to branch structure if needed
	// Persist immediately so branch IDs remain stable across API calls
	if conversation.EnsureBranches() {
		if err := s.chatServiceV2.UpdateConversationV2(conversation); err != nil {
			return nil, err
		}
	}

	// Use specified branch_id if provided, otherwise use active branch
	branchID := req.GetBranchId()

	// Validate that the provided branchId exists in the conversation
	if branchID != "" {
		if conversation.GetBranchByID(branchID) == nil {
			return nil, shared.ErrBadRequest("branch_id not found in conversation")
		}
	}

	return &chatv2.GetConversationResponse{
		Conversation: mapper.MapModelConversationToProtoV2WithBranch(conversation, branchID),
	}, nil
}
