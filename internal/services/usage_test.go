package services_test

import (
	"context"
	"os"
	"testing"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func setupTestUsageService(t *testing.T) (*services.UsageService, *mongo.Database) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	dbInstance, err := db.NewDB(cfg.GetCfg(), logger.GetLogger())
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}
	return services.NewUsageService(dbInstance, cfg.GetCfg(), logger.GetLogger()),
		dbInstance.Database("paperdebugger")
}

// TestTrackUsage_FailedCompletion verifies that when a completion fails
// (success=false), the cost is recorded under failed_cost (not success_cost)
// across all three buckets: hourly, weekly, and lifetime.
func TestTrackUsage_FailedCompletion(t *testing.T) {
	us, database := setupTestUsageService(t)
	ctx := context.Background()

	userID := bson.NewObjectID()
	projectID := "test-project-" + bson.NewObjectID().Hex()
	cost := 0.0125

	// Clean up after the test
	t.Cleanup(func() {
		filter := bson.M{"user_id": userID, "project_id": projectID}
		_, _ = database.Collection(models.HourlyUsage{}.CollectionName()).DeleteMany(ctx, filter)
		_, _ = database.Collection(models.WeeklyUsage{}.CollectionName()).DeleteMany(ctx, filter)
		_, _ = database.Collection(models.LifetimeUsage{}.CollectionName()).DeleteMany(ctx, filter)
	})

	err := us.TrackUsage(ctx, userID, projectID, cost, false)
	assert.NoError(t, err)

	now := time.Now()

	// Hourly bucket: failed_cost incremented, success_cost untouched.
	var hourly models.HourlyUsage
	err = database.Collection(models.HourlyUsage{}.CollectionName()).FindOne(ctx, bson.M{
		"user_id":     userID,
		"project_id":  projectID,
		"hour_bucket": bson.NewDateTimeFromTime(models.TruncateToHour(now)),
	}).Decode(&hourly)
	assert.NoError(t, err)
	assert.InDelta(t, cost, hourly.FailedCost, 1e-9)
	assert.Equal(t, 0.0, hourly.SuccessCost)

	// Weekly bucket.
	var weekly models.WeeklyUsage
	err = database.Collection(models.WeeklyUsage{}.CollectionName()).FindOne(ctx, bson.M{
		"user_id":     userID,
		"project_id":  projectID,
		"week_bucket": bson.NewDateTimeFromTime(models.TruncateToWeek(now)),
	}).Decode(&weekly)
	assert.NoError(t, err)
	assert.InDelta(t, cost, weekly.FailedCost, 1e-9)
	assert.Equal(t, 0.0, weekly.SuccessCost)

	// Lifetime bucket.
	var lifetime models.LifetimeUsage
	err = database.Collection(models.LifetimeUsage{}.CollectionName()).FindOne(ctx, bson.M{
		"user_id":    userID,
		"project_id": projectID,
	}).Decode(&lifetime)
	assert.NoError(t, err)
	assert.InDelta(t, cost, lifetime.FailedCost, 1e-9)
	assert.Equal(t, 0.0, lifetime.SuccessCost)
}

// TestTrackUsage_FailedThenSuccess verifies that failed and successful
// completions accumulate into separate fields on the same bucket document.
func TestTrackUsage_FailedThenSuccess(t *testing.T) {
	us, database := setupTestUsageService(t)
	ctx := context.Background()

	userID := bson.NewObjectID()
	projectID := "test-project-" + bson.NewObjectID().Hex()
	failedCost := 0.02
	successCost := 0.05

	t.Cleanup(func() {
		filter := bson.M{"user_id": userID, "project_id": projectID}
		_, _ = database.Collection(models.HourlyUsage{}.CollectionName()).DeleteMany(ctx, filter)
		_, _ = database.Collection(models.WeeklyUsage{}.CollectionName()).DeleteMany(ctx, filter)
		_, _ = database.Collection(models.LifetimeUsage{}.CollectionName()).DeleteMany(ctx, filter)
	})

	assert.NoError(t, us.TrackUsage(ctx, userID, projectID, failedCost, false))
	assert.NoError(t, us.TrackUsage(ctx, userID, projectID, successCost, true))

	var lifetime models.LifetimeUsage
	err := database.Collection(models.LifetimeUsage{}.CollectionName()).FindOne(ctx, bson.M{
		"user_id":    userID,
		"project_id": projectID,
	}).Decode(&lifetime)
	assert.NoError(t, err)
	assert.InDelta(t, failedCost, lifetime.FailedCost, 1e-9)
	assert.InDelta(t, successCost, lifetime.SuccessCost, 1e-9)
}

// TestTrackUsage_ZeroCostNoOp verifies that a zero-cost failed completion
// (e.g., the provider never returned a usage chunk) writes nothing.
func TestTrackUsage_ZeroCostNoOp(t *testing.T) {
	us, database := setupTestUsageService(t)
	ctx := context.Background()

	userID := bson.NewObjectID()
	projectID := "test-project-" + bson.NewObjectID().Hex()

	err := us.TrackUsage(ctx, userID, projectID, 0, false)
	assert.NoError(t, err)

	count, err := database.Collection(models.LifetimeUsage{}.CollectionName()).CountDocuments(ctx, bson.M{
		"user_id":    userID,
		"project_id": projectID,
	})
	assert.NoError(t, err)
	assert.Equal(t, int64(0), count)
}
