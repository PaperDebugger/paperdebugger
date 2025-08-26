package services

import (
	"context"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type UserService struct {
	BaseService
	userCollection *mongo.Collection
}

func NewUserService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *UserService {
	base := NewBaseService(db, cfg, logger)
	return &UserService{
		BaseService:    base,
		userCollection: base.db.Collection((models.User{}).CollectionName()),
	}
}

func (s *UserService) UpsertUserByEmail(ctx context.Context, user *models.User) (*models.User, error) {
	if user == nil || user.Email == "" {
		return nil, shared.ErrInvalidUser()
	}

	existingUser, err := s.GetUserByEmail(ctx, user.Email)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, err
	}

	if err == mongo.ErrNoDocuments {
		user.ID = bson.NewObjectID()
		user.CreatedAt = bson.NewDateTimeFromTime(time.Now())
		user.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

		// Initialize with default settings for new users
		user.Settings = s.GetDefaultSettings()

		_, err := s.userCollection.InsertOne(ctx, user)
		if err != nil {
			return nil, err
		}
		return user, nil
	} else {
		user.ID = existingUser.ID
		user.CreatedAt = existingUser.CreatedAt
		user.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
		user.Settings = existingUser.Settings

		filter := bson.M{"email": user.Email}
		update := bson.M{"$set": user}
		_, err := s.userCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, err
		}
		return user, nil
	}
}

func (s *UserService) GetUserByID(ctx context.Context, userID bson.ObjectID) (*models.User, error) {
	result := s.userCollection.FindOne(ctx, bson.M{"_id": userID})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	result := s.userCollection.FindOne(ctx, bson.M{"email": email})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *UserService) GetUserSettings(ctx context.Context, userID bson.ObjectID) (*models.Settings, error) {
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &user.Settings, nil
}

func (s *UserService) UpdateUserSettings(ctx context.Context, userID bson.ObjectID, settings models.Settings) (*models.Settings, error) {
	filter := bson.M{"_id": userID}
	update := bson.M{
		"$set": bson.M{
			"settings":   settings,
			"updated_at": bson.NewDateTimeFromTime(time.Now()),
		},
	}
	_, err := s.userCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, err
	}

	return &settings, nil
}

func (s *UserService) GetDefaultSettings() models.Settings {
	return models.Settings{
		ShowShortcutsAfterSelection:  true,
		FullWidthPaperDebuggerButton: true,
		EnableCompletion:             false,
		FullDocumentRag:              false,
		ShowedOnboarding:             false,
	}
}

func (s *UserService) ResetUserSettings(ctx context.Context, userID bson.ObjectID) (*models.Settings, error) {
	defaultSettings := s.GetDefaultSettings()
	return s.UpdateUserSettings(ctx, userID, defaultSettings)
}

func (s *UserService) GetUserInstructions(ctx context.Context, userID bson.ObjectID) (string, error) {
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return "", err
	}
	return user.Instructions, nil
}

func (s *UserService) UpsertUserInstructions(ctx context.Context, userID bson.ObjectID, instructions string) (string, error) {
	filter := bson.M{"_id": userID}
	update := bson.M{
		"$set": bson.M{
			"instructions": instructions,
			"updated_at":   bson.NewDateTimeFromTime(time.Now()),
		},
	}
	_, err := s.userCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return "", err
	}

	return instructions, nil
}
