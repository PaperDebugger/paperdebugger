package mapper

import (
	"paperdebugger/internal/models"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/samber/lo"
	"go.mongodb.org/mongo-driver/v2/bson"
	"google.golang.org/protobuf/encoding/protojson"
)

func BSONToChatMessageV2(msg bson.M) *chatv2.Message {
	jsonBytes, err := bson.MarshalExtJSON(msg, true, true)
	if err != nil {
		return nil
	}

	m := &chatv2.Message{}
	if err := protojson.Unmarshal(jsonBytes, m); err != nil {
		return nil
	}
	return m
}

// MapModelConversationToProtoV2 converts a conversation model to proto.
// Uses the active branch by default, or the specified branchID if provided.
func MapModelConversationToProtoV2(conversation *models.Conversation) *chatv2.Conversation {
	return MapModelConversationToProtoV2WithBranch(conversation, "")
}

// MapModelConversationToProtoV2WithBranch converts a conversation model to proto
// with explicit branch selection. If branchID is empty, uses the active branch.
func MapModelConversationToProtoV2WithBranch(conversation *models.Conversation, branchID string) *chatv2.Conversation {
	// Ensure branches are initialized (migrate legacy data if needed)
	conversation.EnsureBranches()

	// Determine which branch to use
	var selectedBranch *models.Branch
	var currentBranchID string
	var currentBranchIndex int32

	if branchID != "" {
		selectedBranch = conversation.GetBranchByID(branchID)
	}
	if selectedBranch == nil {
		selectedBranch = conversation.GetActiveBranch()
	}

	// Get messages from the selected branch or use legacy fallback
	var inappHistory []bson.M
	if selectedBranch != nil {
		inappHistory = selectedBranch.InappChatHistory
		currentBranchID = selectedBranch.ID
		currentBranchIndex = int32(conversation.GetBranchIndex(selectedBranch.ID))
	} else {
		// Fallback to legacy fields (should not happen after EnsureBranches)
		inappHistory = conversation.InappChatHistory
		currentBranchID = ""
		currentBranchIndex = 1
	}

	// Convert BSON messages back to protobuf messages
	filteredMessages := lo.Map(inappHistory, func(msg bson.M, _ int) *chatv2.Message {
		return BSONToChatMessageV2(msg)
	})

	filteredMessages = lo.Filter(filteredMessages, func(msg *chatv2.Message, _ int) bool {
		return msg.GetPayload().GetMessageType() != &chatv2.MessagePayload_System{}
	})

	modelSlug := conversation.ModelSlug
	if modelSlug == "" {
		modelSlug = models.SlugFromLanguageModel(models.LanguageModel(conversation.LanguageModel))
	}

	// Build branch info list
	branches := lo.Map(conversation.Branches, func(b models.Branch, _ int) *chatv2.BranchInfo {
		return &chatv2.BranchInfo{
			Id:        b.ID,
			CreatedAt: int64(b.CreatedAt),
			UpdatedAt: int64(b.UpdatedAt),
		}
	})

	return &chatv2.Conversation{
		Id:                 conversation.ID.Hex(),
		Title:              conversation.Title,
		ModelSlug:          modelSlug,
		Messages:           filteredMessages,
		CurrentBranchId:    currentBranchID,
		Branches:           branches,
		CurrentBranchIndex: currentBranchIndex,
		TotalBranches:      int32(len(conversation.Branches)),
	}
}
