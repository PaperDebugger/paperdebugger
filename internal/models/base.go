package models

import (
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Model interface {
	CollectionName() string
}

type BaseModel struct {
	ID        bson.ObjectID  `bson:"_id"`
	CreatedAt bson.DateTime  `bson:"created_at"`
	UpdatedAt bson.DateTime  `bson:"updated_at"`
	DeletedAt *bson.DateTime `bson:"deleted_at,omitempty"`
}
