package services

import (
	"context"
	"errors"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type PromptService struct {
	BaseService
	promptCollection *mongo.Collection
}

func NewPromptService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *PromptService {
	base := NewBaseService(db, cfg, logger)
	return &PromptService{
		BaseService:      base,
		promptCollection: base.db.Collection((models.Prompt{}).CollectionName()),
	}
}

func (s *PromptService) ListPrompts(ctx context.Context, userID bson.ObjectID) ([]*models.Prompt, error) {
	filter := bson.M{
		"user_id": userID,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}

	cursor, err := s.promptCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var prompts []*models.Prompt
	if err := cursor.All(ctx, &prompts); err != nil {
		return nil, err
	}
	return prompts, nil
}

func (s *PromptService) CreatePrompt(ctx context.Context, userID bson.ObjectID, prompt *models.Prompt) (*models.Prompt, error) {
	if prompt == nil {
		return nil, errors.New("prompt cannot be nil")
	}

	prompt.BaseModel = models.BaseModel{
		ID:        bson.NewObjectID(),
		CreatedAt: bson.NewDateTimeFromTime(time.Now()),
		UpdatedAt: bson.NewDateTimeFromTime(time.Now()),
	}
	prompt.UserID = userID

	_, err := s.promptCollection.InsertOne(ctx, prompt)
	if err != nil {
		return nil, err
	}

	return prompt, nil
}

func (s *PromptService) UpdatePrompt(ctx context.Context, userID bson.ObjectID, promptID string, updates *models.Prompt) (*models.Prompt, error) {
	if updates == nil {
		return nil, errors.New("updates cannot be nil")
	}

	objectID, err := bson.ObjectIDFromHex(promptID)
	if err != nil {
		return nil, err
	}

	existing, err := s.getPromptByID(ctx, objectID)
	if err != nil {
		return nil, err
	}

	if existing.UserID != userID {
		return nil, errors.New("cannot update other user's prompts")
	}

	updates.ID = existing.ID
	updates.UserID = existing.UserID
	updates.CreatedAt = existing.CreatedAt
	updates.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	_, err = s.promptCollection.ReplaceOne(ctx, bson.M{
		"_id": objectID,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}, updates)
	if err != nil {
		return nil, err
	}

	return updates, nil
}

func (s *PromptService) DeletePrompt(ctx context.Context, userID bson.ObjectID, promptID string) error {
	objectID, err := bson.ObjectIDFromHex(promptID)
	if err != nil {
		return err
	}

	existing, err := s.getPromptByID(ctx, objectID)
	if err != nil {
		return err
	}

	if existing.UserID != userID {
		return errors.New("cannot delete other user's prompts")
	}

	now := bson.NewDateTimeFromTime(time.Now())
	_, err = s.promptCollection.UpdateOne(
		ctx,
		bson.M{
			"_id": objectID,
			"$or": []bson.M{
				{"deleted_at": nil},
				{"deleted_at": bson.M{"$exists": false}},
			},
		},
		bson.M{"$set": bson.M{"deleted_at": now, "updated_at": now}},
	)
	return err
}

func (s *PromptService) getPromptByID(ctx context.Context, id bson.ObjectID) (*models.Prompt, error) {
	result := s.promptCollection.FindOne(ctx, bson.M{
		"_id": id,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	})
	if result.Err() != nil {
		if result.Err() == mongo.ErrNoDocuments {
			return nil, errors.New("prompt not found")
		}
		return nil, result.Err()
	}

	var prompt models.Prompt
	if err := result.Decode(&prompt); err != nil {
		return nil, err
	}

	return &prompt, nil
}
