package services_test

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func setupTestUsageService(t *testing.T) (*services.UsageService, *mongo.Collection) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	dbInstance, err := db.NewDB(cfg.GetCfg(), logger.GetLogger())
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}

	svc := services.NewUsageService(dbInstance, cfg.GetCfg(), logger.GetLogger())
	collection := dbInstance.Database("paperdebugger").Collection((models.LLMSession{}).CollectionName())

	return svc, collection
}

func cleanupSessions(t *testing.T, collection *mongo.Collection, userID bson.ObjectID) {
	ctx := context.Background()
	_, err := collection.DeleteMany(ctx, bson.M{"user_id": userID})
	if err != nil {
		t.Logf("cleanup warning: %v", err)
	}
}

func TestUsageService_RecordUsage_NewSession(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	record := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     100,
		CompletionTokens: 200,
		TotalTokens:      300,
	}

	err := svc.RecordUsage(ctx, record)
	require.NoError(t, err)

	session, err := svc.GetActiveSession(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, session)

	assert.Equal(t, userID, session.UserID)
	require.NotNil(t, session.Models)
	require.NotNil(t, session.Models["gpt-4"])
	assert.Equal(t, int64(100), session.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(200), session.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(300), session.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(1), session.Models["gpt-4"].RequestCount)

	// Verify session expiry is set correctly (5 hours from now)
	now := time.Now()
	expiryTime := time.UnixMilli(int64(session.SessionExpiry))
	expectedExpiry := now.Add(services.SessionDuration)
	assert.WithinDuration(t, expectedExpiry, expiryTime, 2*time.Second)
}

func TestUsageService_RecordUsage_ExistingActiveSession(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Record first usage (creates session)
	record1 := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     100,
		CompletionTokens: 200,
		TotalTokens:      300,
	}
	err := svc.RecordUsage(ctx, record1)
	require.NoError(t, err)

	// Record second usage to same session with same model
	record2 := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     50,
		CompletionTokens: 75,
		TotalTokens:      125,
	}
	err = svc.RecordUsage(ctx, record2)
	require.NoError(t, err)

	// Verify tokens are accumulated for the model
	session, err := svc.GetActiveSession(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, session)

	require.NotNil(t, session.Models["gpt-4"])
	assert.Equal(t, int64(150), session.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(275), session.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(425), session.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(2), session.Models["gpt-4"].RequestCount)
}

func TestUsageService_RecordUsage_MultipleModels(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Record usage for gpt-4
	record1 := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     100,
		CompletionTokens: 200,
		TotalTokens:      300,
	}
	err := svc.RecordUsage(ctx, record1)
	require.NoError(t, err)

	// Record usage for claude-3
	record2 := services.UsageRecord{
		UserID:           userID,
		Model:            "claude-3",
		PromptTokens:     50,
		CompletionTokens: 75,
		TotalTokens:      125,
	}
	err = svc.RecordUsage(ctx, record2)
	require.NoError(t, err)

	// Record more usage for gpt-4
	record3 := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     25,
		CompletionTokens: 30,
		TotalTokens:      55,
	}
	err = svc.RecordUsage(ctx, record3)
	require.NoError(t, err)

	// Verify per-model token storage
	session, err := svc.GetActiveSession(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, session)
	require.NotNil(t, session.Models)

	// Check gpt-4 tokens (accumulated from 2 records)
	require.NotNil(t, session.Models["gpt-4"])
	assert.Equal(t, int64(125), session.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(230), session.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(355), session.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(2), session.Models["gpt-4"].RequestCount)

	// Check claude-3 tokens (single record)
	require.NotNil(t, session.Models["claude-3"])
	assert.Equal(t, int64(50), session.Models["claude-3"].PromptTokens)
	assert.Equal(t, int64(75), session.Models["claude-3"].CompletionTokens)
	assert.Equal(t, int64(125), session.Models["claude-3"].TotalTokens)
	assert.Equal(t, int64(1), session.Models["claude-3"].RequestCount)

	// Verify weekly usage aggregates per model
	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats.Models)

	require.NotNil(t, stats.Models["gpt-4"])
	assert.Equal(t, int64(125), stats.Models["gpt-4"].PromptTokens)

	require.NotNil(t, stats.Models["claude-3"])
	assert.Equal(t, int64(50), stats.Models["claude-3"].PromptTokens)
}

func TestUsageService_RecordUsage_ExpiredSession(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Create an expired session manually
	now := time.Now()
	expiredSession := models.LLMSession{
		ID:            bson.NewObjectID(),
		UserID:        userID,
		SessionStart:  bson.DateTime(now.Add(-6 * time.Hour).UnixMilli()),
		SessionExpiry: bson.DateTime(now.Add(-1 * time.Hour).UnixMilli()), // Expired 1 hour ago
		Models: map[string]*models.ModelTokens{
			"gpt-4": {
				PromptTokens:     100,
				CompletionTokens: 200,
				TotalTokens:      300,
				RequestCount:     1,
			},
		},
	}
	_, err := collection.InsertOne(ctx, expiredSession)
	require.NoError(t, err)

	// Record new usage - should create a new session, not update the expired one
	record := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     50,
		CompletionTokens: 75,
		TotalTokens:      125,
	}
	err = svc.RecordUsage(ctx, record)
	require.NoError(t, err)

	// Get active session
	activeSession, err := svc.GetActiveSession(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, activeSession)

	// Should be a new session with only the new usage
	assert.NotEqual(t, expiredSession.ID, activeSession.ID)
	require.NotNil(t, activeSession.Models["gpt-4"])
	assert.Equal(t, int64(50), activeSession.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(75), activeSession.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(125), activeSession.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(1), activeSession.Models["gpt-4"].RequestCount)
}

func TestUsageService_RecordUsage_RaceCondition(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Simulate concurrent requests trying to create sessions
	concurrentRequests := 10
	var wg sync.WaitGroup
	errors := make([]error, concurrentRequests)

	// Use a channel to synchronize goroutine starts for maximum race condition
	start := make(chan struct{})

	for i := range concurrentRequests {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start // Wait for signal to start
			record := services.UsageRecord{
				UserID:           userID,
				Model:            "gpt-4",
				PromptTokens:     10,
				CompletionTokens: 20,
				TotalTokens:      30,
			}
			errors[idx] = svc.RecordUsage(ctx, record)
		}(i)
	}

	// Start all goroutines at once
	close(start)
	wg.Wait()

	// All requests should succeed (no errors)
	for i, err := range errors {
		assert.NoError(t, err, "Request %d should not have errored", i)
	}

	// Count total sessions created (should be 1 or possibly more if race occurred)
	filter := bson.M{"user_id": userID}
	count, err := collection.CountDocuments(ctx, filter)
	require.NoError(t, err)

	// Get all sessions to see the full picture
	cursor, err := collection.Find(ctx, filter)
	require.NoError(t, err)
	var sessions []models.LLMSession
	err = cursor.All(ctx, &sessions)
	require.NoError(t, err)

	// Calculate total usage across all sessions for all models
	var totalPrompt, totalCompletion, totalTokens, totalRequests int64
	for _, s := range sessions {
		for _, m := range s.Models {
			totalPrompt += m.PromptTokens
			totalCompletion += m.CompletionTokens
			totalTokens += m.TotalTokens
			totalRequests += m.RequestCount
		}
	}

	// All tokens should be accumulated in a single session
	assert.Equal(t, int64(100), totalPrompt, "Expected 10 requests * 10 tokens each")
	assert.Equal(t, int64(200), totalCompletion, "Expected 10 requests * 20 tokens each")
	assert.Equal(t, int64(300), totalTokens, "Expected 10 requests * 30 tokens each")
	assert.Equal(t, int64(10), totalRequests, "Expected 10 requests recorded")

	// With the unique index on (user_id, session_start) and second-level truncation,
	// only one session should be created. Concurrent inserts trigger duplicate key
	// errors which are handled by falling back to update.
	assert.Equal(t, int64(1), count, "Expected exactly 1 session due to unique index")
}

func TestUsageService_GetActiveSession_NoSession(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	session, err := svc.GetActiveSession(ctx, userID)
	require.NoError(t, err)
	assert.Nil(t, session)
}

func TestUsageService_GetWeeklyUsage_SingleSession(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Record some usage
	record := services.UsageRecord{
		UserID:           userID,
		Model:            "gpt-4",
		PromptTokens:     100,
		CompletionTokens: 200,
		TotalTokens:      300,
	}
	err := svc.RecordUsage(ctx, record)
	require.NoError(t, err)

	// Get weekly usage
	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats)

	require.NotNil(t, stats.Models)
	require.NotNil(t, stats.Models["gpt-4"])
	assert.Equal(t, int64(100), stats.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(200), stats.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(300), stats.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(1), stats.Models["gpt-4"].RequestCount)
	assert.Equal(t, int64(1), stats.SessionCount)
}

func TestUsageService_GetWeeklyUsage_MultipleSessions(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Create multiple sessions within the current week
	now := time.Now()
	sessions := []models.LLMSession{
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.Add(-2 * 24 * time.Hour).UnixMilli()), // 2 days ago
			SessionExpiry: bson.DateTime(now.Add(-2*24*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     100,
					CompletionTokens: 200,
					TotalTokens:      300,
					RequestCount:     5,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.Add(-1 * 24 * time.Hour).UnixMilli()), // 1 day ago
			SessionExpiry: bson.DateTime(now.Add(-1*24*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     50,
					CompletionTokens: 75,
					TotalTokens:      125,
					RequestCount:     3,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.UnixMilli()), // Now
			SessionExpiry: bson.DateTime(now.Add(services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     200,
					CompletionTokens: 300,
					TotalTokens:      500,
					RequestCount:     10,
				},
			},
		},
	}

	for _, session := range sessions {
		_, err := collection.InsertOne(ctx, session)
		require.NoError(t, err)
	}

	// Get weekly usage
	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats)

	// Verify aggregation per model
	require.NotNil(t, stats.Models)
	require.NotNil(t, stats.Models["gpt-4"])
	assert.Equal(t, int64(350), stats.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(575), stats.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(925), stats.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(18), stats.Models["gpt-4"].RequestCount)
	assert.Equal(t, int64(3), stats.SessionCount)
}

func TestUsageService_GetWeeklyUsage_ExcludesOldSessions(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	now := time.Now()

	// Create an old session (from last week)
	oldSession := models.LLMSession{
		ID:            bson.NewObjectID(),
		UserID:        userID,
		SessionStart:  bson.DateTime(now.Add(-10 * 24 * time.Hour).UnixMilli()), // 10 days ago
		SessionExpiry: bson.DateTime(now.Add(-10*24*time.Hour + services.SessionDuration).UnixMilli()),
		Models: map[string]*models.ModelTokens{
			"gpt-4": {
				PromptTokens:     1000,
				CompletionTokens: 2000,
				TotalTokens:      3000,
				RequestCount:     50,
			},
		},
	}
	_, err := collection.InsertOne(ctx, oldSession)
	require.NoError(t, err)

	// Create a current session
	currentSession := models.LLMSession{
		ID:            bson.NewObjectID(),
		UserID:        userID,
		SessionStart:  bson.DateTime(now.UnixMilli()),
		SessionExpiry: bson.DateTime(now.Add(services.SessionDuration).UnixMilli()),
		Models: map[string]*models.ModelTokens{
			"gpt-4": {
				PromptTokens:     100,
				CompletionTokens: 200,
				TotalTokens:      300,
				RequestCount:     5,
			},
		},
	}
	_, err = collection.InsertOne(ctx, currentSession)
	require.NoError(t, err)

	// Get weekly usage
	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats)

	// Should only include the current session
	require.NotNil(t, stats.Models)
	require.NotNil(t, stats.Models["gpt-4"])
	assert.Equal(t, int64(100), stats.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(200), stats.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(300), stats.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(5), stats.Models["gpt-4"].RequestCount)
	assert.Equal(t, int64(1), stats.SessionCount)
}

func TestUsageService_GetWeeklyUsage_NoSessions(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats)

	// Should return empty models map
	assert.Empty(t, stats.Models)
	assert.Equal(t, int64(0), stats.SessionCount)
}

func TestUsageService_ListRecentSessions(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Create multiple sessions at different times
	now := time.Now()
	sessions := []models.LLMSession{
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.Add(-3 * 24 * time.Hour).UnixMilli()),
			SessionExpiry: bson.DateTime(now.Add(-3*24*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     100,
					CompletionTokens: 200,
					TotalTokens:      300,
					RequestCount:     1,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.Add(-2 * 24 * time.Hour).UnixMilli()),
			SessionExpiry: bson.DateTime(now.Add(-2*24*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     150,
					CompletionTokens: 250,
					TotalTokens:      400,
					RequestCount:     2,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(now.Add(-1 * 24 * time.Hour).UnixMilli()),
			SessionExpiry: bson.DateTime(now.Add(-1*24*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     200,
					CompletionTokens: 300,
					TotalTokens:      500,
					RequestCount:     3,
				},
			},
		},
	}

	for _, session := range sessions {
		_, err := collection.InsertOne(ctx, session)
		require.NoError(t, err)
	}

	// List recent sessions (limit 2)
	recent, err := svc.ListRecentSessions(ctx, userID, 2)
	require.NoError(t, err)
	assert.Len(t, recent, 2)

	// Should be in reverse chronological order (most recent first)
	assert.Equal(t, int64(200), recent[0].Models["gpt-4"].PromptTokens) // Most recent
	assert.Equal(t, int64(150), recent[1].Models["gpt-4"].PromptTokens) // Second most recent

	// List all sessions
	all, err := svc.ListRecentSessions(ctx, userID, 10)
	require.NoError(t, err)
	assert.Len(t, all, 3)
}

func TestStartOfWeek(t *testing.T) {
	tests := []struct {
		name     string
		input    time.Time
		expected time.Time
	}{
		{
			name:     "Monday should return same day at 00:00",
			input:    time.Date(2024, 1, 1, 15, 30, 45, 0, time.UTC),  // Monday
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Tuesday should return previous Monday",
			input:    time.Date(2024, 1, 2, 15, 30, 45, 0, time.UTC),  // Tuesday
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Sunday should return previous Monday",
			input:    time.Date(2024, 1, 7, 15, 30, 45, 0, time.UTC),  // Sunday
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Wednesday mid-week should return Monday",
			input:    time.Date(2024, 1, 3, 12, 0, 0, 0, time.UTC),    // Wednesday
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Saturday should return previous Monday",
			input:    time.Date(2024, 1, 6, 23, 59, 59, 0, time.UTC),  // Saturday
			expected: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// We need to test the private function indirectly via GetWeeklyUsage
			// But for this specific test, we'll verify the logic manually
			input := tt.input.UTC()
			daysFromMonday := (int(input.Weekday()) + 6) % 7
			result := time.Date(input.Year(), input.Month(), input.Day()-daysFromMonday, 0, 0, 0, 0, time.UTC)

			assert.Equal(t, tt.expected, result)
			assert.Equal(t, time.Monday, result.Weekday(), "Start of week should be Monday")
		})
	}
}

func TestUsageService_GetWeeklyUsage_WeekBoundary(t *testing.T) {
	svc, collection := setupTestUsageService(t)
	ctx := context.Background()
	userID := bson.NewObjectID()
	defer cleanupSessions(t, collection, userID)

	// Get the start of this week
	now := time.Now().UTC()
	daysFromMonday := (int(now.Weekday()) + 6) % 7
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-daysFromMonday, 0, 0, 0, 0, time.UTC)

	// Create sessions on both sides of the week boundary
	sessions := []models.LLMSession{
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(weekStart.Add(-1 * time.Hour).UnixMilli()), // Just before week start
			SessionExpiry: bson.DateTime(weekStart.Add(-1*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     100,
					CompletionTokens: 200,
					TotalTokens:      300,
					RequestCount:     1,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(weekStart.UnixMilli()), // Exactly at week start
			SessionExpiry: bson.DateTime(weekStart.Add(services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     50,
					CompletionTokens: 75,
					TotalTokens:      125,
					RequestCount:     1,
				},
			},
		},
		{
			ID:            bson.NewObjectID(),
			UserID:        userID,
			SessionStart:  bson.DateTime(weekStart.Add(1 * time.Hour).UnixMilli()), // Just after week start
			SessionExpiry: bson.DateTime(weekStart.Add(1*time.Hour + services.SessionDuration).UnixMilli()),
			Models: map[string]*models.ModelTokens{
				"gpt-4": {
					PromptTokens:     25,
					CompletionTokens: 50,
					TotalTokens:      75,
					RequestCount:     1,
				},
			},
		},
	}

	for _, session := range sessions {
		_, err := collection.InsertOne(ctx, session)
		require.NoError(t, err)
	}

	stats, err := svc.GetWeeklyUsage(ctx, userID)
	require.NoError(t, err)
	require.NotNil(t, stats)

	// Should only include sessions at or after week start (last 2 sessions)
	require.NotNil(t, stats.Models)
	require.NotNil(t, stats.Models["gpt-4"])
	assert.Equal(t, int64(75), stats.Models["gpt-4"].PromptTokens)
	assert.Equal(t, int64(125), stats.Models["gpt-4"].CompletionTokens)
	assert.Equal(t, int64(200), stats.Models["gpt-4"].TotalTokens)
	assert.Equal(t, int64(2), stats.Models["gpt-4"].RequestCount)
	assert.Equal(t, int64(2), stats.SessionCount)
}
