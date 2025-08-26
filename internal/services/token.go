package services

import (
	"context"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Token struct {
	ID        bson.ObjectID `bson:"_id"`
	UserID    bson.ObjectID `bson:"user_id"`
	Type      string        `bson:"type"`
	Token     string        `bson:"token,unique"`
	ExpiresAt time.Time     `bson:"expires_at"`
}

type TokenService struct {
	BaseService
	tokenCollection *mongo.Collection
}

func NewTokenService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *TokenService {
	base := NewBaseService(db, cfg, logger)
	return &TokenService{
		BaseService:     base,
		tokenCollection: base.db.Collection("tokens"),
	}
}

func (s *TokenService) CreateRefreshToken(ctx context.Context, userID bson.ObjectID) (*Token, error) {
	token := &Token{
		ID:        bson.NewObjectID(),
		UserID:    userID,
		Type:      "refreshToken",
		Token:     bson.NewObjectID().Hex(),
		ExpiresAt: time.Now().Add(time.Hour * 24 * 30),
	}
	_, err := s.tokenCollection.InsertOne(ctx, token)
	return token, err
}

func (s *TokenService) GetTokenByToken(ctx context.Context, token string) (*Token, error) {
	var tokenObj Token
	err := s.tokenCollection.FindOne(ctx, bson.M{"token": token}).Decode(&tokenObj)
	if err != nil {
		return nil, err
	}
	return &tokenObj, nil
}

func (s *TokenService) UpdateToken(ctx context.Context, token *Token) (*Token, error) {
	_, err := s.tokenCollection.UpdateOne(ctx, bson.M{"_id": token.ID}, bson.M{"$set": token})
	if err != nil {
		return nil, err
	}
	return token, nil
}

func (s *TokenService) DeleteToken(ctx context.Context, token *Token) error {
	_, err := s.tokenCollection.DeleteOne(ctx, bson.M{"_id": token.ID})
	return err
}
