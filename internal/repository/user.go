package repository

import (
	"context"
	"time"

	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// UserRepository defines the interface for user data access
type UserRepository interface {
	FindByID(ctx context.Context, userID bson.ObjectID) (*models.User, error)
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	Insert(ctx context.Context, user *models.User) error
	Update(ctx context.Context, user *models.User) error
}

// MongoUserRepository implements UserRepository using MongoDB
type MongoUserRepository struct {
	BaseRepository
	collection *mongo.Collection
}

// NewMongoUserRepository creates a new MongoUserRepository
func NewMongoUserRepository(db *db.DB) *MongoUserRepository {
	base := NewBaseRepository(db)
	return &MongoUserRepository{
		BaseRepository: base,
		collection:     base.db.Collection((models.User{}).CollectionName()),
	}
}

func (r *MongoUserRepository) FindByID(ctx context.Context, userID bson.ObjectID) (*models.User, error) {
	result := r.collection.FindOne(ctx, bson.M{"_id": userID})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *MongoUserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	result := r.collection.FindOne(ctx, bson.M{"email": email})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var user models.User
	if err := result.Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *MongoUserRepository) Insert(ctx context.Context, user *models.User) error {
	user.ID = bson.NewObjectID()
	user.CreatedAt = bson.NewDateTimeFromTime(time.Now())
	user.UpdatedAt = bson.NewDateTimeFromTime(time.Now())

	_, err := r.collection.InsertOne(ctx, user)
	return err
}

func (r *MongoUserRepository) Update(ctx context.Context, user *models.User) error {
	user.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	filter := bson.M{"_id": user.ID}
	update := bson.M{"$set": user}
	_, err := r.collection.UpdateOne(ctx, filter, update)
	return err
}
