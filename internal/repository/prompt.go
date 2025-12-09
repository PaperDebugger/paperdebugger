package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// PromptRepository defines the interface for prompt data access
type PromptRepository interface {
	FindByID(ctx context.Context, promptID bson.ObjectID) (*models.Prompt, error)
	FindByUserID(ctx context.Context, userID bson.ObjectID) ([]*models.Prompt, error)
	Insert(ctx context.Context, prompt *models.Prompt) error
	Update(ctx context.Context, prompt *models.Prompt) error
	SoftDelete(ctx context.Context, promptID bson.ObjectID) error
}

// MongoPromptRepository implements PromptRepository using MongoDB
type MongoPromptRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoPromptRepository creates a new MongoPromptRepository
func NewMongoPromptRepository(db *db.DB) *MongoPromptRepository {
	base := NewBaseRepository(db)
	return &MongoPromptRepository{
		BaseRepository: base,
		collection:     base.db.Collection((models.Prompt{}).CollectionName()),
	}
}

func (r *MongoPromptRepository) FindByID(ctx context.Context, promptID bson.ObjectID) (*models.Prompt, error) {
	filter := bson.M{"_id": promptID}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	result := r.collection.FindOne(ctx, filter)
	if result.Err() != nil {
		return nil, result.Err()
	}

	var prompt models.Prompt
	if err := result.Decode(&prompt); err != nil {
		return nil, err
	}

	return &prompt, nil
}

func (r *MongoPromptRepository) FindByUserID(ctx context.Context, userID bson.ObjectID) ([]*models.Prompt, error) {
	filter := bson.M{"user_id": userID}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	cursor, err := r.collection.Find(ctx, filter)
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

func (r *MongoPromptRepository) Insert(ctx context.Context, prompt *models.Prompt) error {
	prompt.ID = bson.NewObjectID()
	prompt.CreatedAt = bson.NewDateTimeFromTime(time.Now())
	prompt.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	_, err := r.collection.InsertOne(ctx, prompt)
	return err
}

func (r *MongoPromptRepository) Update(ctx context.Context, prompt *models.Prompt) error {
	prompt.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	filter := bson.M{"_id": prompt.ID}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	_, err := r.collection.ReplaceOne(ctx, filter, prompt)
	return err
}

func (r *MongoPromptRepository) SoftDelete(ctx context.Context, promptID bson.ObjectID) error {
	now := bson.NewDateTimeFromTime(time.Now())

	filter := bson.M{"_id": promptID}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	_, err := r.collection.UpdateOne(ctx, filter, bson.M{
		"$set": bson.M{"deleted_at": now, "updated_at": now},
	})
	return err
}
