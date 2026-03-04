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
	Model            string
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
}

// ModelUsageStats stores aggregated usage statistics for a specific model.
type ModelUsageStats struct {
	PromptTokens     int64   `bson:"prompt_tokens"`
	CompletionTokens int64   `bson:"completion_tokens"`
	TotalTokens      int64   `bson:"total_tokens"`
	RequestCount     int64   `bson:"request_count"`
	CostUSD          float64 `bson:"-"` // Calculated field, not stored
}

type UsageStats struct {
	Models       map[string]*ModelUsageStats `bson:"models"`
	SessionCount int64                       `bson:"session_count"`
	TotalCostUSD float64                     `bson:"-"` // Calculated field, not stored
}

// CalculateCosts calculates the cost in USD for each model and total.
// pricingMap maps model slug to pricing info.
func (s *UsageStats) CalculateCosts(pricingMap map[string]*models.ModelPricing) {
	s.TotalCostUSD = 0
	for modelSlug, stats := range s.Models {
		if pricing, ok := pricingMap[modelSlug]; ok && pricing != nil {
			stats.CostUSD = float64(stats.PromptTokens)*pricing.PromptPrice +
				float64(stats.CompletionTokens)*pricing.CompletionPrice
			s.TotalCostUSD += stats.CostUSD
		}
	}
}

func NewUsageService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UsageService {
	base := NewBaseService(db, cfg, logger)
	return &UsageService{
		BaseService:       base,
		sessionCollection: base.db.Collection((models.LLMSession{}).CollectionName()),
	}
}

// RecordUsage updates the active session or creates a new one if none exists.
// Falls back to update if insert fails (handles race when another request created a session).
func (s *UsageService) RecordUsage(ctx context.Context, record UsageRecord) error {
	now := time.Now()
	nowBson := bson.DateTime(now.UnixMilli())

	// Build field paths for per-model token storage
	modelPrefix := "models." + record.Model
	filter := bson.M{
		"user_id":        record.UserID,
		"session_expiry": bson.M{"$gt": nowBson},
	}
	update := bson.M{
		"$inc": bson.M{
			modelPrefix + ".prompt_tokens":     record.PromptTokens,
			modelPrefix + ".completion_tokens": record.CompletionTokens,
			modelPrefix + ".total_tokens":      record.TotalTokens,
			modelPrefix + ".request_count":     1,
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
		ID:            bson.NewObjectID(),
		UserID:        record.UserID,
		SessionStart:  nowBson,
		SessionExpiry: bson.DateTime(now.Add(SessionDuration).UnixMilli()),
		Models: map[string]*models.ModelTokens{
			record.Model: {
				PromptTokens:     record.PromptTokens,
				CompletionTokens: record.CompletionTokens,
				TotalTokens:      record.TotalTokens,
				RequestCount:     1,
			},
		},
	}
	_, err = s.sessionCollection.InsertOne(ctx, session)
	if err != nil {
		// Only retry with update if insert failed due to duplicate key (race condition)
		if mongo.IsDuplicateKeyError(err) {
			_, updateErr := s.sessionCollection.UpdateOne(ctx, filter, update)
			if updateErr != nil {
				// Log both errors for debugging
				s.logger.Warn("Insert failed with duplicate key, update also failed",
					"insertErr", err,
					"updateErr", updateErr,
					"userID", record.UserID)
				return updateErr
			}
			// Race condition handled successfully
			return nil
		}
		// Insert failed for non-duplicate-key reason (network, validation, etc.)
		return err
	}
	return nil
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
		// Convert models map to array for aggregation
		bson.M{"$project": bson.M{
			"models_array":  bson.M{"$objectToArray": "$models"},
			"session_count": bson.M{"$literal": 1},
		}},
		// Unwind the models array to aggregate per model
		bson.M{"$unwind": bson.M{
			"path":                       "$models_array",
			"preserveNullAndEmptyArrays": true,
		}},
		// Group by model name and sum tokens
		bson.M{"$group": bson.M{
			"_id":               "$models_array.k",
			"prompt_tokens":     bson.M{"$sum": "$models_array.v.prompt_tokens"},
			"completion_tokens": bson.M{"$sum": "$models_array.v.completion_tokens"},
			"total_tokens":      bson.M{"$sum": "$models_array.v.total_tokens"},
			"request_count":     bson.M{"$sum": "$models_array.v.request_count"},
		}},
		// Reshape into array of model stats
		bson.M{"$group": bson.M{
			"_id": nil,
			"models": bson.M{"$push": bson.M{
				"k": "$_id",
				"v": bson.M{
					"prompt_tokens":     "$prompt_tokens",
					"completion_tokens": "$completion_tokens",
					"total_tokens":      "$total_tokens",
					"request_count":     "$request_count",
				},
			}},
		}},
		// Convert back to object
		bson.M{"$project": bson.M{
			"models": bson.M{"$arrayToObject": "$models"},
		}},
	}

	cursor, err := s.sessionCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	// Get session count separately (simpler query)
	countPipeline := bson.A{
		bson.M{"$match": bson.M{
			"user_id":       userID,
			"session_start": bson.M{"$gte": bson.DateTime(since.UnixMilli())},
		}},
		bson.M{"$count": "session_count"},
	}
	countCursor, err := s.sessionCollection.Aggregate(ctx, countPipeline)
	if err != nil {
		return nil, err
	}
	defer countCursor.Close(ctx)

	var sessionCount int64
	if countCursor.Next(ctx) {
		var countResult struct {
			SessionCount int64 `bson:"session_count"`
		}
		if err := countCursor.Decode(&countResult); err != nil {
			return nil, err
		}
		sessionCount = countResult.SessionCount
	}

	if cursor.Next(ctx) {
		var result UsageStats
		if err := cursor.Decode(&result); err != nil {
			return nil, err
		}
		result.SessionCount = sessionCount
		return &result, nil
	}
	return &UsageStats{Models: make(map[string]*ModelUsageStats)}, nil
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
