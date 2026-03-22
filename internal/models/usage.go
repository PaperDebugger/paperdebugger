package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Usage tracks cost per user, per project, per model, per hour.
// Each document represents one hour bucket of usage.
type Usage struct {
	ID         bson.ObjectID `bson:"_id"`
	UserID     bson.ObjectID `bson:"user_id"`
	ProjectID  string        `bson:"project_id"`
	ModelSlug  string        `bson:"model_slug"`
	HourBucket bson.DateTime `bson:"hour_bucket"` // Timestamp truncated to the hour
	Cost       float64       `bson:"cost"`        // Cost in USD
	UpdatedAt  bson.DateTime `bson:"updated_at"`
}

func (u Usage) CollectionName() string {
	return "usages"
}

// TruncateToHour truncates a time to the start of its hour.
func TruncateToHour(t time.Time) time.Time {
	return t.Truncate(time.Hour)
}
