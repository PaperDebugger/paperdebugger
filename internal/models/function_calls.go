package models

import (
	"go.mongodb.org/mongo-driver/v2/bson"
)

type FunctionCallStatus string

const (
	FunctionCallStatusPending FunctionCallStatus = "pending"
	FunctionCallStatusSuccess FunctionCallStatus = "success"
	FunctionCallStatusError   FunctionCallStatus = "error"
	FunctionCallStatusTimeout FunctionCallStatus = "timeout"
)

type FunctionCall struct {
	BaseModel      `bson:",inline"`
	UserID         bson.ObjectID      `bson:"user_id"`
	ProjectID      string             `bson:"project_id"`
	ConversationID string             `bson:"conversation_id"`
	ToolCallID     string             `bson:"tool_call_id"`
	FunctionName   string             `bson:"function_name"`
	FunctionParams string             `bson:"function_params"` // json string
	FunctionResult string             `bson:"function_result"` // json string
	FunctionError  string             `bson:"function_error"`  // json string
	FunctionStatus FunctionCallStatus `bson:"function_status"`
}

func (c FunctionCall) CollectionName() string {
	return "function_calls"
}
