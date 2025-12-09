package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// ProjectRepository defines the interface for project data access
type ProjectRepository interface {
	FindByUserAndProjectID(ctx context.Context, userID bson.ObjectID, projectID string) (*models.Project, error)
	Insert(ctx context.Context, project *models.Project) error
	Update(ctx context.Context, project *models.Project) error
	UpdateCategory(ctx context.Context, userID bson.ObjectID, projectID string, category models.ClassifyPaperResponse) error
	UpdateInstructions(ctx context.Context, userID bson.ObjectID, projectID string, instructions string) error
}

// MongoProjectRepository implements ProjectRepository using MongoDB
type MongoProjectRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoProjectRepository creates a new MongoProjectRepository
func NewMongoProjectRepository(db *db.DB) *MongoProjectRepository {
	base := NewBaseRepository(db)
	return &MongoProjectRepository{
		BaseRepository: base,
		collection:     base.db.Collection((models.Project{}).CollectionName()),
	}
}

func (r *MongoProjectRepository) FindByUserAndProjectID(ctx context.Context, userID bson.ObjectID, projectID string) (*models.Project, error) {
	result := r.collection.FindOne(ctx, bson.M{"user_id": userID, "project_id": projectID})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var project models.Project
	if err := result.Decode(&project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (r *MongoProjectRepository) Insert(ctx context.Context, project *models.Project) error {
	project.ID = bson.NewObjectID()
	project.CreatedAt = bson.NewDateTimeFromTime(time.Now())
	project.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	_, err := r.collection.InsertOne(ctx, project)
	return err
}

func (r *MongoProjectRepository) Update(ctx context.Context, project *models.Project) error {
	project.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": project.ID}, bson.M{"$set": project})
	return err
}

func (r *MongoProjectRepository) UpdateCategory(ctx context.Context, userID bson.ObjectID, projectID string, category models.ClassifyPaperResponse) error {
	filter := bson.M{"user_id": userID, "project_id": projectID}
	update := bson.M{
		"$set": bson.M{
			"category":   category,
			"updated_at": bson.NewDateTimeFromTime(time.Now()),
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}

func (r *MongoProjectRepository) UpdateInstructions(ctx context.Context, userID bson.ObjectID, projectID string, instructions string) error {
	filter := bson.M{"user_id": userID, "project_id": projectID}
	update := bson.M{
		"$set": bson.M{
			"instructions": instructions,
			"updated_at":   bson.NewDateTimeFromTime(time.Now()),
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}
