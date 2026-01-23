package services

import (
	"context"
	"errors"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type OAuthService struct {
	BaseService
	oauthCollection *mongo.Collection
}

func NewOAuthService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *OAuthService {
	base := NewBaseService(db, cfg, logger)
	collection := base.db.Collection((models.OAuth{}).CollectionName())

	indexModels := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "code", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.M{"code": bson.M{"$exists": true}}),
		},
		{
			Keys: bson.D{{Key: "access_token", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.M{"access_token": bson.M{"$exists": true}}),
		},
		{
			Keys: bson.D{{Key: "state", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.M{"state": bson.M{"$exists": true}}),
		},
	}
	_, err := collection.Indexes().CreateMany(context.Background(), indexModels)
	if err != nil {
		logger.Error("Failed to create indexes for OAuth collection", err)
	}

	return &OAuthService{
		BaseService:     base,
		oauthCollection: collection,
	}
}

func (s *OAuthService) CreateOAuthRecord(ctx context.Context, code, state, accessToken string) error {
	// Check if state already exists
	var existing models.OAuth
	err := s.oauthCollection.FindOne(ctx, bson.M{"state": state}).Decode(&existing)
	if err == nil {
		// Record exists - allow if within 10s window (idempotent callback)
		if time.Since(existing.CreatedAt.Time()) <= OAuthReuseWindow {
			return nil
		}
		return errors.New("state already exists, please restart the login process")
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}

	// Create new record
	now := time.Now()
	callback := &models.OAuth{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: bson.NewDateTimeFromTime(now),
			UpdatedAt: bson.NewDateTimeFromTime(now),
		},
		Code:        code,
		AccessToken: accessToken,
		State:       state,
		Used:        false,
	}

	_, err = s.oauthCollection.InsertOne(ctx, callback)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Race condition: another request just created it, treat as success
			return nil
		}
		return err
	}
	return nil
}

func (s *OAuthService) GetOAuthRecordByState(ctx context.Context, state string) (*models.OAuth, error) {
	var cb models.OAuth
	err := s.oauthCollection.FindOne(ctx, bson.M{"state": state}).Decode(&cb)
	if err != nil {
		return nil, err
	}
	return &cb, nil
}

func (s *OAuthService) OAuthMakeUsed(ctx context.Context, cb *models.OAuth) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"used":       true,
			"used_at":    bson.NewDateTimeFromTime(now),
			"updated_at": bson.NewDateTimeFromTime(now),
		},
	}
	_, err := s.oauthCollection.UpdateOne(ctx, bson.M{"_id": cb.ID}, update)
	return err
}

// OAuthReuseWindow is the time window (10 seconds) during which a used OAuth record can still be reused
const OAuthReuseWindow = 10 * time.Second

// IsWithinReuseWindow checks if the OAuth record was used within the reuse window
func (s *OAuthService) IsWithinReuseWindow(cb *models.OAuth) bool {
	if !cb.Used || cb.UsedAt == 0 {
		return false
	}
	usedAt := cb.UsedAt.Time()
	return time.Since(usedAt) <= OAuthReuseWindow
}
