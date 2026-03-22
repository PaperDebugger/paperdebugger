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

type UsageService struct {
	BaseService
	usageCollection *mongo.Collection
}

func NewUsageService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UsageService {
	base := NewBaseService(db, cfg, logger)
	return &UsageService{
		BaseService:     base,
		usageCollection: base.db.Collection((models.Usage{}).CollectionName()),
	}
}

// TrackUsage increments cost for a user/project/model/hour bucket.
// Uses upsert to create or update the usage record atomically.
func (s *UsageService) TrackUsage(ctx context.Context, userID bson.ObjectID, projectID string, modelSlug string, cost float64) error {
	if cost == 0 {
		return nil
	}

	now := time.Now()
	hourBucket := models.TruncateToHour(now)

	filter := bson.M{
		"user_id":     userID,
		"project_id":  projectID,
		"model_slug":  modelSlug,
		"hour_bucket": bson.NewDateTimeFromTime(hourBucket),
	}

	update := bson.M{
		"$inc": bson.M{
			"cost": cost,
		},
		"$set": bson.M{
			"updated_at": bson.NewDateTimeFromTime(now),
		},
		"$setOnInsert": bson.M{
			"_id": bson.NewObjectID(),
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := s.usageCollection.UpdateOne(ctx, filter, update, opts)
	return err
}
