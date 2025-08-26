package services

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"

	"go.mongodb.org/mongo-driver/v2/mongo"
)

type BaseService struct {
	db     *mongo.Database
	cfg    *cfg.Cfg
	logger *logger.Logger
}

func NewBaseService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) BaseService {
	return BaseService{
		db:     db.Database("paperdebugger"),
		cfg:    cfg,
		logger: logger,
	}
}
