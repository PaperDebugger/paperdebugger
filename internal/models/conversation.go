package models

import (
	"github.com/openai/openai-go/v2/responses"
	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Conversation struct {
	BaseModel        `bson:",inline"`
	UserID           bson.ObjectID `bson:"user_id"`
	ProjectID        string        `bson:"project_id"`
	Title            string        `bson:"title"`
	LanguageModel    LanguageModel `bson:"language_model"`     // deprecated: use ModelSlug instead
	ModelSlug        string        `bson:"model_slug"`         // new: model slug string
	InappChatHistory []bson.M      `bson:"inapp_chat_history"` // Store as raw BSON to avoid protobuf decoding issues

	OpenaiChatHistory           responses.ResponseInputParam             `bson:"openai_chat_history"`            // 实际上发给 GPT 的聊天历史
	OpenaiChatParams            responses.ResponseNewParams              `bson:"openai_chat_params"`             // 对话的参数，比如 temperature, etc.
	OpenaiChatHistoryCompletion []openai.ChatCompletionMessageParamUnion `bson:"openai_chat_history_completion"` // 实际上发给 GPT 的聊天历史（新版本回退老API）
	OpenaiChatParamsCompletion  openai.ChatCompletionNewParams           `bson:"openai_chat_params_completion"`  // 对话的参数，比如 temperature, etc.（新版本回退老API）
}

func (c Conversation) CollectionName() string {
	return "conversations"
}
