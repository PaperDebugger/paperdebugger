package db

import (
	"context"
	"encoding/json"
	"errors"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ToolCallRecordDB struct {
	collection *mongo.Collection
}

func NewToolCallRecordDB(db *db.DB) *ToolCallRecordDB {
	database := db.Database("paperdebugger")
	collection := database.Collection((models.FunctionCall{}).CollectionName())

	return &ToolCallRecordDB{
		collection: collection,
	}
}

func (r *ToolCallRecordDB) Create(ctx context.Context, toolCallId string, functionName string, functionParams map[string]any) (*models.FunctionCall, error) {
	actor, projectId, conversationID := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" || conversationID == "" {
		return nil, errors.New("failed to get actor, project id, or conversation id")
	}

	functionParamsJSON, err := json.Marshal(functionParams)
	if err != nil {
		return nil, err
	}

	record := &models.FunctionCall{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: bson.NewDateTimeFromTime(time.Now()),
			UpdatedAt: bson.NewDateTimeFromTime(time.Now()),
		},
		UserID:         actor.ID,
		ProjectID:      projectId,
		ConversationID: conversationID,
		ToolCallID:     toolCallId,
		FunctionName:   functionName,
		FunctionParams: string(functionParamsJSON),
		FunctionStatus: models.FunctionCallStatusPending,
	}

	_, err = r.collection.InsertOne(ctx, record)
	if err != nil {
		return nil, errors.New("failed to insert function call record: " + err.Error())
	}

	return record, nil
}

// Get the latest function call record for a given tool name, user id, and project id.
func (r *ToolCallRecordDB) GetLatest(ctx context.Context, toolName string, userID string, projectID string) (*models.FunctionCall, error) {
	actor, projectId, conversationID := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" || conversationID == "" {
		return nil, errors.New("failed to get actor, project id, or conversation id")
	}

	filter := bson.M{
		"function_name": toolName,
		"user_id":       actor.ID,
		"project_id":    projectId,
	}

	var record models.FunctionCall
	err := r.collection.FindOne(ctx, filter, options.FindOne().SetSort(bson.M{"created_at": -1})).Decode(&record)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, errors.New("failed to query latest pending function call record: " + err.Error())
	}

	return &record, nil
}

func (r *ToolCallRecordDB) CheckCoolDown(ctx context.Context, toolName string, userID string, projectID string, coolDownTime time.Duration) error {
	record, err := r.GetLatest(ctx, toolName, userID, projectID)
	if err != nil {
		return err
	}

	if record == nil {
		return nil
	}

	coolDownPeriod := record.CreatedAt.Time().Add(coolDownTime).After(time.Now())

	if coolDownPeriod {
		if record.FunctionStatus == models.FunctionCallStatusSuccess {
			return errors.New("last function call is successful, please wait for " + coolDownTime.String() + " to call this function again")
		} else if record.FunctionStatus == models.FunctionCallStatusPending {
			return errors.New("last function call is pending, please wait for " + coolDownTime.String() + " to call this function again")
		} else if record.FunctionStatus == models.FunctionCallStatusError {
			return errors.New("last function call is error, please wait for " + coolDownTime.String() + " to call this function again")
		} else if record.FunctionStatus == models.FunctionCallStatusTimeout {
			return nil // by pass the cool down time here, because the function is timeout, so we can call it again
		}
	}

	if !coolDownPeriod && record.FunctionStatus == models.FunctionCallStatusPending {
		return r.OnTimeout(ctx, record)
	}
	return nil
}

func (r *ToolCallRecordDB) OnTimeout(ctx context.Context, record *models.FunctionCall) error {
	record.FunctionStatus = models.FunctionCallStatusTimeout
	record.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": record.ID}, bson.M{"$set": record})
	if err != nil {
		return errors.New("failed to update function call record: " + err.Error())
	}
	return nil
}

func (r *ToolCallRecordDB) OnError(ctx context.Context, record *models.FunctionCall, err error) error {
	record.FunctionError = err.Error()
	record.FunctionStatus = models.FunctionCallStatusError
	// record.FunctionResult = "" // do not reset the result here, because the result may be saved during the function call
	record.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": record.ID}, bson.M{"$set": record})
	if err != nil {
		return errors.New("failed to update function call record: " + err.Error())
	}
	return nil
}

func (r *ToolCallRecordDB) OnSuccess(ctx context.Context, record *models.FunctionCall, result string) error {
	record.FunctionResult = result
	record.FunctionStatus = models.FunctionCallStatusSuccess
	record.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": record.ID}, bson.M{"$set": record})
	if err != nil {
		return errors.New("failed to update function call record: " + err.Error())
	}
	return nil
}
