package models

import (
	"github.com/openai/openai-go/v2/responses"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Conversation struct {
	BaseModel        `bson:",inline"`
	UserID           bson.ObjectID `bson:"user_id"`
	ProjectID        string        `bson:"project_id"`
	Title            string        `bson:"title"`
	LanguageModel    LanguageModel `bson:"language_model"`
	InappChatHistory []bson.M      `bson:"inapp_chat_history"` // Store as raw BSON to avoid protobuf decoding issues

	OpenaiChatHistory responses.ResponseInputParam `bson:"openai_chat_history"` // The actual chat history sent to LLM Providers.
	OpenaiChatParams  responses.ResponseNewParams  `bson:"openai_chat_params"`  // Conversation parameters like temperature, etc.
}

func (c Conversation) CollectionName() string {
	return "conversations"
}
