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
	collection := base.db.Collection((models.Usage{}).CollectionName())

	indexModels := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "project_id", Value: 1},
				{Key: "model_slug", Value: 1},
				{Key: "hour_bucket", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "hour_bucket", Value: 1},
			},
			Options: options.Index().SetExpireAfterSeconds(14 * 24 * 60 * 60), // 2 weeks TTL
		},
	}
	_, err := collection.Indexes().CreateMany(context.Background(), indexModels)
	if err != nil {
		logger.Error("Failed to create indexes for usages collection", err)
	}

	return &UsageService{
		BaseService:     base,
		usageCollection: collection,
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
