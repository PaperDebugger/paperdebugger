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

func (s *UsageService) RecordUsage(ctx context.Context, userID bson.ObjectID, modelSlug string, promptTokens, completionTokens, totalTokens int64) error {
	now := bson.DateTime(time.Now().UnixMilli())
	usage := models.Usage{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		UserID:           userID,
		ModelSlug:        modelSlug,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      totalTokens,
	}

	_, err := s.usageCollection.InsertOne(ctx, usage)
	return err
}
