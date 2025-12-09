package repository

import (
	"context"
	"errors"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// OAuthRepository defines the interface for OAuth data access
type OAuthRepository interface {
	FindByState(ctx context.Context, state string) (*models.OAuth, error)
	CountByState(ctx context.Context, state string) (int64, error)
	Insert(ctx context.Context, oauth *models.OAuth) error
	MarkAsUsed(ctx context.Context, oauthID bson.ObjectID) error
}

// MongoOAuthRepository implements OAuthRepository using MongoDB
type MongoOAuthRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoOAuthRepository creates a new MongoOAuthRepository
func NewMongoOAuthRepository(db *db.DB, logger interface{ Error(msg string, args ...any) }) *MongoOAuthRepository {
	base := NewBaseRepository(db)
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

	return &MongoOAuthRepository{
		BaseRepository: base,
		collection:     collection,
	}
}

func (r *MongoOAuthRepository) FindByState(ctx context.Context, state string) (*models.OAuth, error) {
	var oauth models.OAuth
	err := r.collection.FindOne(ctx, bson.M{"state": state}).Decode(&oauth)
	if err != nil {
		return nil, err
	}
	return &oauth, nil
}

func (r *MongoOAuthRepository) CountByState(ctx context.Context, state string) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{"state": state})
}

func (r *MongoOAuthRepository) Insert(ctx context.Context, oauth *models.OAuth) error {
	now := time.Now()
	oauth.ID = bson.NewObjectID()
	oauth.CreatedAt = bson.NewDateTimeFromTime(now)
	oauth.UpdatedAt = bson.NewDateTimeFromTime(now)

	_, err := r.collection.InsertOne(ctx, oauth)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return errors.New("code already exists, please do not refresh the page")
		}
		return err
	}
	return nil
}

func (r *MongoOAuthRepository) MarkAsUsed(ctx context.Context, oauthID bson.ObjectID) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"used":       true,
			"updated_at": bson.NewDateTimeFromTime(now),
		},
	}
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": oauthID}, update)
	return err
}
