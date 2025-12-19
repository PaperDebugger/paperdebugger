package auth

import (
	"context"
	"os"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestAuthServer(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	cfg := cfg.GetCfg()
	logger := logger.GetLogger()
	db, err := db.NewDB(cfg, logger)
	if err != nil {
		t.Fatalf("Failed to create db: %v", err)
	}
	tokenService := services.NewTokenService(db, cfg, logger)
	userService := services.NewUserService(db, cfg, logger)
	authServer := NewAuthServer(tokenService, userService, cfg, logger)
	assert.NotNil(t, authServer)

	t.Run("refresh token not exist", func(t *testing.T) {
		// test refresh token
		resp, err := authServer.RefreshToken(context.Background(),
			&authv1.RefreshTokenRequest{
				RefreshToken: "refreshToken",
			},
		)
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("refresh token expired", func(t *testing.T) {
		userId := bson.NewObjectID()
		timeNow := time.Now()
		token, err := tokenService.CreateRefreshToken(context.Background(), userId)
		if err != nil {
			t.Fatalf("Failed to create refresh token: %v", err)
		}
		assert.Equal(t, token.UserID, userId)

		token.ExpiresAt = timeNow.Add(-time.Hour * 24)
		token, err = tokenService.UpdateToken(context.Background(), token)
		if err != nil {
			t.Fatalf("Failed to update refresh token: %v", err)
		}
		assert.True(t, token.ExpiresAt.Before(timeNow))

		// Now Token expiration should be 24 hours ago
		token, err = tokenService.GetTokenByToken(context.Background(), token.Token)
		if err != nil {
			t.Fatalf("Failed to get refresh token: %v", err)
		}
		assert.True(t, token.ExpiresAt.Before(timeNow))

		// At this point RefreshToken should be invalid
		resp, err := authServer.RefreshToken(context.Background(),
			&authv1.RefreshTokenRequest{
				RefreshToken: token.Token,
			},
		)
		assert.Error(t, err)
		assert.Nil(t, resp)

		// Update Token expiration to 24 hours later
		token.ExpiresAt = timeNow.Add(time.Hour * 24)
		token, err = tokenService.UpdateToken(context.Background(), token)
		if err != nil {
			t.Fatalf("Failed to update refresh token: %v", err)
		}
		assert.True(t, token.ExpiresAt.After(timeNow))

		// At this point RefreshToken should be valid
		resp, err = authServer.RefreshToken(context.Background(),
			&authv1.RefreshTokenRequest{
				RefreshToken: token.Token,
			},
		)
		assert.NoError(t, err)
		assert.NotNil(t, resp)

		// After RefreshToken, expiration should be refreshed to one month later
		token, err = tokenService.GetTokenByToken(context.Background(), resp.RefreshToken)
		if err != nil {
			t.Fatalf("Failed to get refresh token: %v", err)
		}
		assert.True(t, token.ExpiresAt.After(timeNow.Add(time.Hour*24*30)))

		// Logout, delete the refresh token
		_, err = authServer.Logout(context.Background(), &authv1.LogoutRequest{
			RefreshToken: resp.RefreshToken,
		})
		assert.NoError(t, err)

		// Logout again, should return error
		_, err = authServer.Logout(context.Background(), &authv1.LogoutRequest{
			RefreshToken: resp.RefreshToken,
		})
		assert.Error(t, err)
	})
}
