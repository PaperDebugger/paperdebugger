package services_test

import (
	"context"
	"os"
	"testing"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func setupTestTokenService(t *testing.T) *services.TokenService {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017") // 确保本地有 MongoDB
	dbInstance, err := db.NewDB(cfg.GetCfg(), logger.GetLogger())
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}
	return services.NewTokenService(dbInstance, cfg.GetCfg(), logger.GetLogger())
}

func TestTokenService_CRUD(t *testing.T) {
	ts := setupTestTokenService(t)
	ctx := context.Background()

	userID := bson.NewObjectID()

	// Create
	tk, err := ts.CreateRefreshToken(ctx, userID)
	assert.NoError(t, err)
	assert.Equal(t, userID, tk.UserID)
	assert.Equal(t, "refreshToken", tk.Type)
	assert.NotEmpty(t, tk.Token)
	assert.WithinDuration(t, time.Now().Add(30*24*time.Hour), tk.ExpiresAt, 2*time.Hour)

	// Get
	got, err := ts.GetTokenByToken(ctx, tk.Token)
	assert.NoError(t, err)
	assert.Equal(t, tk.ID, got.ID)

	// Update
	tk.ExpiresAt = time.Now().Add(60 * 24 * time.Hour)
	updated, err := ts.UpdateToken(ctx, tk)
	assert.NoError(t, err)
	assert.Equal(t, tk.ExpiresAt.Unix(), updated.ExpiresAt.Unix())

	// Delete
	err = ts.DeleteToken(ctx, tk)
	assert.NoError(t, err)

	// Get after delete
	_, err = ts.GetTokenByToken(ctx, tk.Token)
	assert.Error(t, err)
}
