package models

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/openai/openai-go/v2/responses"
	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// Branch represents a single conversation branch created from message edits
type Branch struct {
	ID                          string                                   `bson:"id"`
	CreatedAt                   bson.DateTime                            `bson:"created_at"`
	UpdatedAt                   bson.DateTime                            `bson:"updated_at"`
	InappChatHistory            []bson.M                                 `bson:"inapp_chat_history"`
	OpenaiChatHistoryCompletion []openai.ChatCompletionMessageParamUnion `bson:"openai_chat_history_completion"`
}

type Conversation struct {
	BaseModel     `bson:",inline"`
	UserID        bson.ObjectID `bson:"user_id"`
	ProjectID     string        `bson:"project_id"`
	Title         string        `bson:"title"`
	LanguageModel LanguageModel `bson:"language_model"`
	ModelSlug     string        `bson:"model_slug"`

	// Multiple branches for edit history
	Branches []Branch `bson:"branches"`

	// Below are legacy fields - kept for backward compatibility with old data
	// When Branches is empty, use these as fallback (treated as default branch)
	InappChatHistory []bson.M `bson:"inapp_chat_history"`

	OpenaiChatHistory           responses.ResponseInputParam             `bson:"openai_chat_history"` // The actual chat history sent to GPT
	OpenaiChatParams            responses.ResponseNewParams              `bson:"openai_chat_params"`  // Conversation parameters, such as temperature, etc.
	OpenaiChatHistoryCompletion []openai.ChatCompletionMessageParamUnion `bson:"openai_chat_history_completion"`
	OpenaiChatParamsCompletion  openai.ChatCompletionNewParams           `bson:"openai_chat_params_completion"`
}

func (c Conversation) CollectionName() string {
	return "conversations"
}

// GetActiveBranch returns the most recently updated branch.
// If no branches exist, returns nil (caller should use legacy fields).
func (c *Conversation) GetActiveBranch() *Branch {
	if len(c.Branches) == 0 {
		return nil
	}

	var activeBranch *Branch
	var latestUpdate bson.DateTime
	for i := range c.Branches {
		if c.Branches[i].UpdatedAt >= latestUpdate {
			latestUpdate = c.Branches[i].UpdatedAt
			activeBranch = &c.Branches[i]
		}
	}
	return activeBranch
}

// GetBranchByID returns the branch with the given ID, or nil if not found.
func (c *Conversation) GetBranchByID(branchID string) *Branch {
	for i := range c.Branches {
		if c.Branches[i].ID == branchID {
			return &c.Branches[i]
		}
	}
	return nil
}

// GetBranchIndex returns the 1-indexed position of the branch with the given ID.
// Returns 0 if not found. Branches are sorted by CreatedAt.
func (c *Conversation) GetBranchIndex(branchID string) int {
	for i := range c.Branches {
		if c.Branches[i].ID == branchID {
			return i + 1
		}
	}
	return 0
}

// CreateNewBranch creates a new branch based on an existing branch,
// truncated after the specified message ID.
// If baseBranchID is empty and there are no branches, uses legacy fields.
// Returns the new branch (already appended to c.Branches) and an error if
// truncateAfterMsgID is provided but the message is not found in the history.
func (c *Conversation) CreateNewBranch(baseBranchID string, truncateAfterMsgID string) (*Branch, error) {
	now := bson.NewDateTimeFromTime(time.Now())
	newBranch := Branch{
		ID:        uuid.New().String(),
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Get source history
	var sourceInappHistory []bson.M
	var sourceOpenaiHistory []openai.ChatCompletionMessageParamUnion

	if baseBranchID != "" {
		baseBranch := c.GetBranchByID(baseBranchID)
		if baseBranch != nil {
			sourceInappHistory = baseBranch.InappChatHistory
			sourceOpenaiHistory = baseBranch.OpenaiChatHistoryCompletion
		}
	}

	// Fallback to legacy fields if no base branch found
	if sourceInappHistory == nil {
		if len(c.Branches) > 0 {
			// Use active branch
			activeBranch := c.GetActiveBranch()
			if activeBranch != nil {
				sourceInappHistory = activeBranch.InappChatHistory
				sourceOpenaiHistory = activeBranch.OpenaiChatHistoryCompletion
			}
		} else {
			// Use legacy fields
			sourceInappHistory = c.InappChatHistory
			sourceOpenaiHistory = c.OpenaiChatHistoryCompletion
		}
	}

	// Handle truncation
	if truncateAfterMsgID == "root" {
		// Clear all history, keep only system message
		newBranch.InappChatHistory = []bson.M{}
		if len(sourceOpenaiHistory) > 0 {
			newBranch.OpenaiChatHistoryCompletion = sourceOpenaiHistory[:1]
		} else {
			newBranch.OpenaiChatHistoryCompletion = []openai.ChatCompletionMessageParamUnion{}
		}
	} else if truncateAfterMsgID != "" {
		// Find parent message and truncate after it
		foundIndex := -1
		for i, msg := range sourceInappHistory {
			if id, ok := msg["messageId"].(string); ok && strings.Contains(id, truncateAfterMsgID) {
				foundIndex = i
				break
			}
		}

		if foundIndex == -1 {
			// Parent message not found - return error instead of silently copying entire history
			return nil, fmt.Errorf("parent message with ID %q not found in conversation history", truncateAfterMsgID)
		}

		// Copy up to and including the parent message
		newBranch.InappChatHistory = make([]bson.M, foundIndex+1)
		copy(newBranch.InappChatHistory, sourceInappHistory[:foundIndex+1])

		// Map index: Inapp[i] -> Openai[i+1] (because Openai[0] is system)
		if len(sourceOpenaiHistory) > foundIndex+1 {
			newBranch.OpenaiChatHistoryCompletion = make([]openai.ChatCompletionMessageParamUnion, foundIndex+2)
			copy(newBranch.OpenaiChatHistoryCompletion, sourceOpenaiHistory[:foundIndex+2])
		} else {
			newBranch.OpenaiChatHistoryCompletion = make([]openai.ChatCompletionMessageParamUnion, len(sourceOpenaiHistory))
			copy(newBranch.OpenaiChatHistoryCompletion, sourceOpenaiHistory)
		}
	} else {
		// No truncation, copy entire history
		newBranch.InappChatHistory = make([]bson.M, len(sourceInappHistory))
		copy(newBranch.InappChatHistory, sourceInappHistory)
		newBranch.OpenaiChatHistoryCompletion = make([]openai.ChatCompletionMessageParamUnion, len(sourceOpenaiHistory))
		copy(newBranch.OpenaiChatHistoryCompletion, sourceOpenaiHistory)
	}

	c.Branches = append(c.Branches, newBranch)
	return &c.Branches[len(c.Branches)-1], nil
}

// EnsureBranches migrates legacy data to branch structure if needed.
// Call this when loading a conversation that might have old data format.
// Returns true if migration occurred (caller should persist the conversation).
func (c *Conversation) EnsureBranches() bool {
	if len(c.Branches) == 0 && len(c.InappChatHistory) > 0 {
		// Migrate legacy data to first branch
		now := bson.NewDateTimeFromTime(time.Now())
		c.Branches = []Branch{{
			ID:                          uuid.New().String(),
			CreatedAt:                   c.CreatedAt,
			UpdatedAt:                   now,
			InappChatHistory:            c.InappChatHistory,
			OpenaiChatHistoryCompletion: c.OpenaiChatHistoryCompletion,
		}}
		return true
	}
	return false
}
