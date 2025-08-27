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

	OpenaiChatHistory responses.ResponseInputParam `bson:"openai_chat_history"` // 实际上发给 GPT 的聊天历史
	OpenaiChatParams  responses.ResponseNewParams  `bson:"openai_chat_params"`  // 对话的参数，比如 temperature, etc.
}

func (c Conversation) CollectionName() string {
	return "conversations"
}
