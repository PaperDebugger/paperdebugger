package db

import (
	"context"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type DB struct {
	*mongo.Client

	cfg    *cfg.Cfg
	logger *logger.Logger
}

func NewDB(cfg *cfg.Cfg, logger *logger.Logger) (*DB, error) {
	TIMEOUT := 10 * time.Second
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	opts := options.Client().
		ApplyURI(cfg.MongoURI).
		SetServerAPIOptions(serverAPI).
		SetTimeout(TIMEOUT) // use SetTimeout instead of SetConnectTimeout
		// Because the timeout will happen on the client.Database.RunCommand

	logger.Infof("[MONGO] URI:     %v", cfg.MongoURI)
	logger.Infof("[MONGO] Timeout: %v", TIMEOUT)

	client, err := mongo.Connect(opts) // the mongo.Connect will return immediately.
	if err != nil {
		return nil, err
	}

	// Send a ping to confirm a successful connection
	var result bson.M
	if err := client.Database("admin").RunCommand(context.TODO(), bson.D{{Key: "ping", Value: 1}}).Decode(&result); err != nil {
		return nil, err
	}

	logger.Info("[MONGO] initialized")

	db := &DB{Client: client, cfg: cfg, logger: logger}
	db.ensureIndexes()
	return db, nil
}

// ensureIndexes creates necessary indexes for the database collections, such as a TTL index.
func (db *DB) ensureIndexes() {
	// Create TTL index on usages collection to automatically delete documents after a certain period (e.g., 4 weeks)
	usages := db.Database("paperdebugger").Collection((models.Usage{}).CollectionName())

	_, err := usages.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "created_at", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(4 * 7 * 24 * 60 * 60),
	})
	if err != nil {
		db.logger.Error("Failed to create TTL index on usages", "error", err)
	}
}
