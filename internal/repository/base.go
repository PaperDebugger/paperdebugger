package repository

import (
	"paperdebugger/internal/libs/db"

	"go.mongodb.org/mongo-driver/v2/mongo"
)

// BaseRepository provides common functionality for all repositories
type BaseRepository struct {
	db *mongo.Database
}

// NewBaseRepository creates a new BaseRepository
func NewBaseRepository(db *db.DB) BaseRepository {
	return BaseRepository{
		db: db.Database("paperdebugger"),
	}
}
