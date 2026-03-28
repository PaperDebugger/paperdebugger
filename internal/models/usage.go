package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// HourlyUsage tracks cost per user, per project, per hour.
// Each document represents one hour bucket of usage.
type HourlyUsage struct {
	ID         bson.ObjectID `bson:"_id"`
	UserID     bson.ObjectID `bson:"user_id"`
	ProjectID  string        `bson:"project_id"`
	HourBucket bson.DateTime `bson:"hour_bucket"` // Timestamp truncated to the hour
	Cost       float64       `bson:"cost"`        // Cost in USD
	UpdatedAt  bson.DateTime `bson:"updated_at"`
}

func (u HourlyUsage) CollectionName() string {
	return "hourly_usages"
}

// WeeklyUsage tracks cost per user, per project, per week.
// Each document represents one week bucket of usage.
type WeeklyUsage struct {
	ID         bson.ObjectID `bson:"_id"`
	UserID     bson.ObjectID `bson:"user_id"`
	ProjectID  string        `bson:"project_id"`
	WeekBucket bson.DateTime `bson:"week_bucket"` // Timestamp truncated to the week (Monday)
	Cost       float64       `bson:"cost"`        // Cost in USD
	UpdatedAt  bson.DateTime `bson:"updated_at"`
}

func (u WeeklyUsage) CollectionName() string {
	return "weekly_usages"
}

// LifetimeUsage tracks total cost per user, per project, across all time.
// Each document represents the cumulative usage for a user-project pair.
type LifetimeUsage struct {
	ID        bson.ObjectID `bson:"_id"`
	UserID    bson.ObjectID `bson:"user_id"`
	ProjectID string        `bson:"project_id"`
	Cost      float64       `bson:"cost"` // Total cost in USD
	UpdatedAt bson.DateTime `bson:"updated_at"`
}

func (u LifetimeUsage) CollectionName() string {
	return "lifetime_usages"
}

// TruncateToHour truncates a time to the start of its hour.
func TruncateToHour(t time.Time) time.Time {
	return t.Truncate(time.Hour)
}

// TruncateToWeek truncates a time to the start of its week (Monday 00:00:00 UTC).
func TruncateToWeek(t time.Time) time.Time {
	t = t.UTC()
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday becomes 7
	}
	// Subtract days to get to Monday
	monday := t.AddDate(0, 0, -(weekday - 1))
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.UTC)
}
