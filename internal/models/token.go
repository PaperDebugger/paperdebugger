package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Token struct {
	ID        bson.ObjectID `bson:"_id"`
	UserID    bson.ObjectID `bson:"user_id"`
	Type      string        `bson:"type"`
	Token     string        `bson:"token,unique"`
	ExpiresAt time.Time     `bson:"expires_at"`
}

func (t Token) CollectionName() string {
	return "tokens"
}
