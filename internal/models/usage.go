package models

import "go.mongodb.org/mongo-driver/v2/bson"

// ModelTokens stores token counts for a specific model.
type ModelTokens struct {
	PromptTokens     int64 `bson:"prompt_tokens"`
	CompletionTokens int64 `bson:"completion_tokens"`
	TotalTokens      int64 `bson:"total_tokens"`
	RequestCount     int64 `bson:"request_count"`
}

// LLMSession represents a user's session for tracking LLM usage and token counts.
// Tokens are stored per model in the Models map.
type LLMSession struct {
	ID            bson.ObjectID           `bson:"_id"`
	UserID        bson.ObjectID           `bson:"user_id"`
	SessionStart  bson.DateTime           `bson:"session_start"`
	SessionExpiry bson.DateTime           `bson:"session_expiry"`
	Models        map[string]*ModelTokens `bson:"models"`
}

func (s LLMSession) CollectionName() string {
	return "llm_sessions"
}
