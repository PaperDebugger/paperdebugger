package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ConversationRepository defines the interface for conversation data access
type ConversationRepository interface {
	FindByID(ctx context.Context, userID, conversationID bson.ObjectID) (*models.Conversation, error)
	FindByUserAndProject(ctx context.Context, userID bson.ObjectID, projectID string, limit int64) ([]*models.Conversation, error)
	Insert(ctx context.Context, conversation *models.Conversation) error
	Update(ctx context.Context, conversation *models.Conversation) error
	SoftDelete(ctx context.Context, userID, conversationID bson.ObjectID) error
}

// MongoConversationRepository implements ConversationRepository using MongoDB
type MongoConversationRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoConversationRepository creates a new MongoConversationRepository
func NewMongoConversationRepository(db *db.DB) *MongoConversationRepository {
	base := NewBaseRepository(db)
	return &MongoConversationRepository{
		BaseRepository: base,
		collection:     base.db.Collection((models.Conversation{}).CollectionName()),
	}
}

// notDeletedFilter returns a filter for non-deleted documents
func notDeletedFilter() bson.M {
	return bson.M{
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}
}

func (r *MongoConversationRepository) FindByID(ctx context.Context, userID, conversationID bson.ObjectID) (*models.Conversation, error) {
	filter := bson.M{
		"_id":     conversationID,
		"user_id": userID,
	}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	conversation := &models.Conversation{}
	err := r.collection.FindOne(ctx, filter).Decode(conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (r *MongoConversationRepository) FindByUserAndProject(ctx context.Context, userID bson.ObjectID, projectID string, limit int64) ([]*models.Conversation, error) {
	filter := bson.M{
		"user_id":    userID,
		"project_id": projectID,
	}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	opts := options.Find().
		SetProjection(bson.M{
			"inapp_chat_history":  0,
			"openai_chat_history": 0,
		}).
		SetSort(bson.M{"updated_at": -1}).
		SetLimit(limit)

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	var conversations []*models.Conversation
	err = cursor.All(ctx, &conversations)
	if err != nil {
		return nil, err
	}
	return conversations, nil
}

func (r *MongoConversationRepository) Insert(ctx context.Context, conversation *models.Conversation) error {
	conversation.ID = bson.NewObjectID()
	conversation.CreatedAt = bson.NewDateTimeFromTime(time.Now())
	conversation.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	_, err := r.collection.InsertOne(ctx, conversation)
	return err
}

func (r *MongoConversationRepository) Update(ctx context.Context, conversation *models.Conversation) error {
	conversation.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	filter := bson.M{"_id": conversation.ID}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	_, err := r.collection.UpdateOne(ctx, filter, bson.M{"$set": conversation})
	return err
}

func (r *MongoConversationRepository) SoftDelete(ctx context.Context, userID, conversationID bson.ObjectID) error {
	now := bson.NewDateTimeFromTime(time.Now())

	filter := bson.M{
		"_id":     conversationID,
		"user_id": userID,
	}
	for k, v := range notDeletedFilter() {
		filter[k] = v
	}

	_, err := r.collection.UpdateOne(ctx, filter, bson.M{
		"$set": bson.M{"deleted_at": now, "updated_at": now},
	})
	return err
}
