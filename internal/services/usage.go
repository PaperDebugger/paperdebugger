package services

import (
	"context"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const SessionDuration = 5 * time.Hour

type UsageService struct {
	BaseService
	sessionCollection *mongo.Collection
}

type UsageRecord struct {
	UserID           bson.ObjectID
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
}

type UsageStats struct {
	PromptTokens     int64 `bson:"prompt_tokens"`
	CompletionTokens int64 `bson:"completion_tokens"`
	TotalTokens      int64 `bson:"total_tokens"`
	RequestCount     int64 `bson:"request_count"`
	SessionCount     int64 `bson:"session_count"`
}

func NewUsageService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UsageService {
	base := NewBaseService(db, cfg, logger)
	return &UsageService{
		BaseService:       base,
		sessionCollection: base.db.Collection((models.LLMSession{}).CollectionName()),
	}
}

// RecordUsage updates the active session or creates a new one if none exists.
// Uses retry logic to handle race conditions when multiple requests try to create a session.
func (s *UsageService) RecordUsage(ctx context.Context, record UsageRecord) error {
	now := time.Now()
	nowBson := bson.DateTime(now.UnixMilli())

	filter := bson.M{
		"user_id":        record.UserID,
		"session_expiry": bson.M{"$gt": nowBson},
	}
	update := bson.M{
		"$inc": bson.M{
			"prompt_tokens":     record.PromptTokens,
			"completion_tokens": record.CompletionTokens,
			"total_tokens":      record.TotalTokens,
			"request_count":     1,
		},
	}

	result, err := s.sessionCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if result.MatchedCount > 0 {
		return nil
	}

	// No active session found - create a new one
	session := models.LLMSession{
		ID:               bson.NewObjectID(),
		UserID:           record.UserID,
		SessionStart:     nowBson,
		SessionExpiry:    bson.DateTime(now.Add(SessionDuration).UnixMilli()),
		PromptTokens:     record.PromptTokens,
		CompletionTokens: record.CompletionTokens,
		TotalTokens:      record.TotalTokens,
		RequestCount:     1,
	}
	_, err = s.sessionCollection.InsertOne(ctx, session)
	if err != nil {
		// Insert failed (race condition or other error) - retry update
		_, err = s.sessionCollection.UpdateOne(ctx, filter, update)
	}
	return err
}

// GetActiveSession returns the current active session for a user, if any.
func (s *UsageService) GetActiveSession(ctx context.Context, userID bson.ObjectID) (*models.LLMSession, error) {
	now := bson.DateTime(time.Now().UnixMilli())
	filter := bson.M{
		"user_id":        userID,
		"session_expiry": bson.M{"$gt": now},
	}

	var session models.LLMSession
	err := s.sessionCollection.FindOne(ctx, filter).Decode(&session)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetWeeklyUsage returns aggregated usage for a user for the current week (Monday-Sunday).
func (s *UsageService) GetWeeklyUsage(ctx context.Context, userID bson.ObjectID) (*UsageStats, error) {
	weekStart := startOfWeek(time.Now())
	return s.getUsageSince(ctx, userID, weekStart)
}

func (s *UsageService) getUsageSince(ctx context.Context, userID bson.ObjectID, since time.Time) (*UsageStats, error) {
	pipeline := bson.A{
		bson.M{"$match": bson.M{
			"user_id":       userID,
			"session_start": bson.M{"$gte": bson.DateTime(since.UnixMilli())},
		}},
		bson.M{"$group": bson.M{
			"_id":               nil,
			"prompt_tokens":     bson.M{"$sum": "$prompt_tokens"},
			"completion_tokens": bson.M{"$sum": "$completion_tokens"},
			"total_tokens":      bson.M{"$sum": "$total_tokens"},
			"request_count":     bson.M{"$sum": "$request_count"},
			"session_count":     bson.M{"$sum": 1},
		}},
	}

	cursor, err := s.sessionCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if cursor.Next(ctx) {
		var result UsageStats
		if err := cursor.Decode(&result); err != nil {
			return nil, err
		}
		return &result, nil
	}
	return &UsageStats{}, nil
}

// startOfWeek returns the start of the week (Monday 00:00:00 UTC).
func startOfWeek(t time.Time) time.Time {
	t = t.UTC()
	daysFromMonday := (int(t.Weekday()) + 6) % 7 // Sunday=6, Monday=0, Tuesday=1, ...
	return time.Date(t.Year(), t.Month(), t.Day()-daysFromMonday, 0, 0, 0, 0, time.UTC)
}

// ListRecentSessions returns the most recent sessions for a user.
func (s *UsageService) ListRecentSessions(ctx context.Context, userID bson.ObjectID, limit int64) ([]models.LLMSession, error) {
	filter := bson.M{"user_id": userID}
	opts := options.Find().
		SetSort(bson.D{{Key: "session_start", Value: -1}}).
		SetLimit(limit)

	cursor, err := s.sessionCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var sessions []models.LLMSession
	if err := cursor.All(ctx, &sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}
