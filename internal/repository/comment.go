package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// CommentRepository defines the interface for comment data access
type CommentRepository interface {
	FindByID(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID) (*models.Comment, error)
	Insert(ctx context.Context, comment *models.Comment) (bson.ObjectID, error)
	Update(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID, comment *models.Comment) error
}

// MongoCommentRepository implements CommentRepository using MongoDB
type MongoCommentRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoCommentRepository creates a new MongoCommentRepository
func NewMongoCommentRepository(db *db.DB) *MongoCommentRepository {
	base := NewBaseRepository(db)
	return &MongoCommentRepository{
		BaseRepository: base,
		collection:     base.db.Collection((models.Comment{}).CollectionName()),
	}
}

func (r *MongoCommentRepository) FindByID(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID) (*models.Comment, error) {
	comment := &models.Comment{}
	err := r.collection.FindOne(ctx, bson.M{
		"_id":        commentID,
		"user_id":    userID,
		"project_id": projectID,
	}).Decode(comment)
	if err != nil {
		return nil, err
	}
	return comment, nil
}

func (r *MongoCommentRepository) Insert(ctx context.Context, comment *models.Comment) (bson.ObjectID, error) {
	comment.ID = bson.NewObjectID()
	comment.CreatedAt = bson.NewDateTimeFromTime(time.Now())
	comment.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	result, err := r.collection.InsertOne(ctx, comment)
	if err != nil {
		return bson.ObjectID{}, err
	}
	return result.InsertedID.(bson.ObjectID), nil
}

func (r *MongoCommentRepository) Update(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID, comment *models.Comment) error {
	comment.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err := r.collection.UpdateOne(ctx, bson.M{
		"_id":        commentID,
		"user_id":    userID,
		"project_id": projectID,
	}, bson.M{"$set": comment})
	return err
}

// Collection returns the underlying MongoDB collection for advanced queries
func (r *MongoCommentRepository) Collection() *mongo.Collection {
	return r.collection
}
