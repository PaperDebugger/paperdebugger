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

type UsageRecord struct {
	UserID           bson.ObjectID
	ModelSlug        string
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
}

func NewUsageService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UsageService {
	base := NewBaseService(db, cfg, logger)
	return &UsageService{
		BaseService:     base,
		usageCollection: base.db.Collection((models.Usage{}).CollectionName()),
	}
}

func (s *UsageService) RecordUsage(ctx context.Context, record UsageRecord) error {
	now := bson.DateTime(time.Now().UnixMilli())
	usage := models.Usage{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		UserID:           record.UserID,
		ModelSlug:        record.ModelSlug,
		PromptTokens:     record.PromptTokens,
		CompletionTokens: record.CompletionTokens,
		TotalTokens:      record.TotalTokens,
	}

	_, err := s.usageCollection.InsertOne(ctx, usage)
	return err
}
