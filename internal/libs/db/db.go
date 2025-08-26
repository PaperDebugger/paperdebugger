package db

import (
	"context"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"

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
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	opts := options.Client().
		ApplyURI(cfg.MongoURI).
		SetServerAPIOptions(serverAPI).
		SetTimeout(10 * time.Second) // use SetTimeout instead of SetConnectTimeout
		// Because the timeout will happen on the client.Database.RunCommand

	client, err := mongo.Connect(opts) // the mongo.Connect will return immediately.
	if err != nil {
		return nil, err
	}

	// Send a ping to confirm a successful connection
	var result bson.M
	if err := client.Database("admin").RunCommand(context.TODO(), bson.D{{Key: "ping", Value: 1}}).Decode(&result); err != nil {
		return nil, err
	}

	logger.Info("db initialized")
	return &DB{Client: client, cfg: cfg, logger: logger}, nil
}
