package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Token represents a refresh token stored in the database
type Token struct {
	ID        bson.ObjectID `bson:"_id"`
	UserID    bson.ObjectID `bson:"user_id"`
	Type      string        `bson:"type"`
	Token     string        `bson:"token,unique"`
	ExpiresAt time.Time     `bson:"expires_at"`
}

// TokenRepository defines the interface for token data access
type TokenRepository interface {
	FindByToken(ctx context.Context, token string) (*Token, error)
	Insert(ctx context.Context, token *Token) error
	Update(ctx context.Context, token *Token) error
	Delete(ctx context.Context, tokenID bson.ObjectID) error
}

// MongoTokenRepository implements TokenRepository using MongoDB
type MongoTokenRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoTokenRepository creates a new MongoTokenRepository
func NewMongoTokenRepository(db *db.DB) *MongoTokenRepository {
	base := NewBaseRepository(db)
	return &MongoTokenRepository{
		BaseRepository: base,
		collection:     base.db.Collection("tokens"),
	}
}

func (r *MongoTokenRepository) FindByToken(ctx context.Context, token string) (*Token, error) {
	var tokenObj Token
	err := r.collection.FindOne(ctx, bson.M{"token": token}).Decode(&tokenObj)
	if err != nil {
		return nil, err
	}
	return &tokenObj, nil
}

func (r *MongoTokenRepository) Insert(ctx context.Context, token *Token) error {
	token.ID = bson.NewObjectID()
	_, err := r.collection.InsertOne(ctx, token)
	return err
}

func (r *MongoTokenRepository) Update(ctx context.Context, token *Token) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": token.ID}, bson.M{"$set": token})
	return err
}

func (r *MongoTokenRepository) Delete(ctx context.Context, tokenID bson.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": tokenID})
	return err
}
