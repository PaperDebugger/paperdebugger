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
	hourlyCollection   *mongo.Collection
	weeklyCollection   *mongo.Collection
	lifetimeCollection *mongo.Collection
}

func NewUsageService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UsageService {
	base := NewBaseService(db, cfg, logger)
	hourlyCollection := base.db.Collection((models.HourlyUsage{}).CollectionName())
	weeklyCollection := base.db.Collection((models.WeeklyUsage{}).CollectionName())
	lifetimeCollection := base.db.Collection((models.LifetimeUsage{}).CollectionName())

	// Hourly usage indexes
	hourlyIndexModels := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "project_id", Value: 1},
				{Key: "hour_bucket", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
				{Key: "hour_bucket", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "hour_bucket", Value: 1},
			},
			Options: options.Index().SetExpireAfterSeconds(14 * 24 * 60 * 60), // 2 weeks TTL
		},
	}
	_, err := hourlyCollection.Indexes().CreateMany(context.Background(), hourlyIndexModels)
	if err != nil {
		logger.Error("Failed to create indexes for hourly_usages collection", err)
	}

	// Weekly usage indexes
	weeklyIndexModels := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "project_id", Value: 1},
				{Key: "week_bucket", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
				{Key: "week_bucket", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "week_bucket", Value: 1},
			},
			Options: options.Index().SetExpireAfterSeconds(14 * 24 * 60 * 60), // 2 weeks TTL
		},
	}
	_, err = weeklyCollection.Indexes().CreateMany(context.Background(), weeklyIndexModels)
	if err != nil {
		logger.Error("Failed to create indexes for weekly_usages collection", err)
	}

	// Lifetime usage indexes (no TTL since it's lifetime)
	lifetimeIndexModels := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "project_id", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "project_id", Value: 1},
			},
		},
	}
	_, err = lifetimeCollection.Indexes().CreateMany(context.Background(), lifetimeIndexModels)
	if err != nil {
		logger.Error("Failed to create indexes for lifetime_usages collection", err)
	}

	return &UsageService{
		BaseService:        base,
		hourlyCollection:   hourlyCollection,
		weeklyCollection:   weeklyCollection,
		lifetimeCollection: lifetimeCollection,
	}
}

// TrackUsage increments cost for a user/project in hourly, weekly, and lifetime buckets.
// Uses upsert to create or update the usage records atomically.
// The success parameter indicates whether the request completed successfully.
// We will be charging only for successful requests, but we track failed requests for monitoring.
func (s *UsageService) TrackUsage(ctx context.Context, userID bson.ObjectID, projectID string, cost float64, success bool) error {
	if cost == 0 {
		return nil
	}

	now := time.Now()

	// Track hourly usage
	if err := s.trackHourlyUsage(ctx, userID, projectID, cost, success, now); err != nil {
		return err
	}

	// Track weekly usage
	if err := s.trackWeeklyUsage(ctx, userID, projectID, cost, success, now); err != nil {
		return err
	}

	// Track lifetime usage
	if err := s.trackLifetimeUsage(ctx, userID, projectID, cost, success, now); err != nil {
		return err
	}

	return nil
}

func (s *UsageService) upsertUsage(ctx context.Context, collection *mongo.Collection, filter bson.M, cost float64, success bool, now time.Time) error {
	costField := "failed_cost"
	if success {
		costField = "success_cost"
	}

	update := bson.M{
		"$inc": bson.M{
			costField: cost,
		},
		"$set": bson.M{
			"updated_at": bson.NewDateTimeFromTime(now),
		},
		"$setOnInsert": bson.M{
			"_id": bson.NewObjectID(),
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := collection.UpdateOne(ctx, filter, update, opts)
	return err
}

func (s *UsageService) trackHourlyUsage(ctx context.Context, userID bson.ObjectID, projectID string, cost float64, success bool, now time.Time) error {
	filter := bson.M{
		"user_id":     userID,
		"project_id":  projectID,
		"hour_bucket": bson.NewDateTimeFromTime(models.TruncateToHour(now)),
	}
	return s.upsertUsage(ctx, s.hourlyCollection, filter, cost, success, now)
}

func (s *UsageService) trackWeeklyUsage(ctx context.Context, userID bson.ObjectID, projectID string, cost float64, success bool, now time.Time) error {
	filter := bson.M{
		"user_id":     userID,
		"project_id":  projectID,
		"week_bucket": bson.NewDateTimeFromTime(models.TruncateToWeek(now)),
	}
	return s.upsertUsage(ctx, s.weeklyCollection, filter, cost, success, now)
}

func (s *UsageService) trackLifetimeUsage(ctx context.Context, userID bson.ObjectID, projectID string, cost float64, success bool, now time.Time) error {
	filter := bson.M{
		"user_id":    userID,
		"project_id": projectID,
	}
	return s.upsertUsage(ctx, s.lifetimeCollection, filter, cost, success, now)
}
