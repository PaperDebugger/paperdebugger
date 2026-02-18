package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Usage struct {
	BaseModel        `bson:",inline"`
	UserID           bson.ObjectID `bson:"user_id"`
	ModelSlug        string        `bson:"model_slug"`
	PromptTokens     int64         `bson:"prompt_tokens"`
	CompletionTokens int64         `bson:"completion_tokens"`
	TotalTokens      int64         `bson:"total_tokens"`
}

func (u Usage) CollectionName() string {
	return "usages"
}
