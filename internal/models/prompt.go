package models

import (
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Prompt struct {
	BaseModel `bson:",inline"`
	UserID    bson.ObjectID `bson:"user_id"`
	Title     string        `bson:"title"`
	Content   string        `bson:"content"`
}

func (p Prompt) CollectionName() string {
	return "prompts"
}
