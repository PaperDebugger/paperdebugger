package services

import (
	"bytes"
	"context"
	_ "embed"
	"strings"
	"text/template"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2/responses"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"google.golang.org/protobuf/encoding/protojson"
)

//go:embed system_prompt_default.tmpl
var systemPromptDefaultTemplate string

//go:embed system_prompt_debug.tmpl
var systemPromptDebugTemplate string

//go:embed user_prompt_default.tmpl
var userPromptDefaultTemplate string

//go:embed user_prompt_debug.tmpl
var userPromptDebugTemplate string

type ChatService struct {
	BaseService
	conversationCollection *mongo.Collection
}

const DefaultConversationTitle = "New Conversation ."

func NewChatService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *ChatService {
	base := NewBaseService(db, cfg, logger)
	return &ChatService{
		BaseService:            base,
		conversationCollection: base.db.Collection(models.Conversation{}.CollectionName()),
	}
}

func (s *ChatService) GetSystemPrompt(ctx context.Context, fullContent string, projectInstructions string, userInstructions string, conversationType chatv1.ConversationType) (string, error) {
	var systemPromptString string
	switch conversationType {
	case chatv1.ConversationType_CONVERSATION_TYPE_DEBUG:
		systemPromptString = systemPromptDebugTemplate
	default:
		systemPromptString = systemPromptDefaultTemplate
	}

	tmpl := template.Must(template.New("system_prompt").Parse(systemPromptString))

	var systemPromptBuffer bytes.Buffer
	if err := tmpl.Execute(&systemPromptBuffer, map[string]string{
		"FullContent":         fullContent,
		"ProjectInstructions": projectInstructions,
		"UserInstructions":    userInstructions,
	}); err != nil {
		return "", err
	}
	return strings.TrimSpace(systemPromptBuffer.String()), nil
}

func (s *ChatService) GetPrompt(ctx context.Context, content string, selectedText string, conversationType chatv1.ConversationType) (string, error) {
	var userPromptString string
	switch conversationType {
	case chatv1.ConversationType_CONVERSATION_TYPE_DEBUG:
		userPromptString = userPromptDebugTemplate
	default:
		userPromptString = userPromptDefaultTemplate
	}

	tmpl := template.Must(template.New("user_prompt").Parse(userPromptString))

	var userPromptBuffer bytes.Buffer
	if err := tmpl.Execute(&userPromptBuffer, map[string]string{
		"UserInput":    content,
		"SelectedText": selectedText,
	}); err != nil {
		return "", err
	}
	return strings.TrimSpace(userPromptBuffer.String()), nil
}

func (s *ChatService) InsertConversationToDB(ctx context.Context, userID bson.ObjectID, projectID string, languageModel models.LanguageModel, inappChatHistory []*chatv1.Message, openaiChatHistory responses.ResponseInputParam) (*models.Conversation, error) {
	// Convert protobuf messages to BSON
	bsonMessages := make([]bson.M, len(inappChatHistory))
	for i := range inappChatHistory {
		jsonBytes, err := protojson.Marshal(inappChatHistory[i])
		if err != nil {
			return nil, err
		}
		var bsonMsg bson.M
		if err := bson.UnmarshalExtJSON(jsonBytes, true, &bsonMsg); err != nil {
			return nil, err
		}
		bsonMessages[i] = bsonMsg
	}

	conversation := &models.Conversation{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: bson.NewDateTimeFromTime(time.Now()),
			UpdatedAt: bson.NewDateTimeFromTime(time.Now()),
		},
		UserID:            userID,
		ProjectID:         projectID,
		Title:             DefaultConversationTitle,
		LanguageModel:     languageModel,
		InappChatHistory:  bsonMessages,
		OpenaiChatHistory: openaiChatHistory,
	}
	_, err := s.conversationCollection.InsertOne(ctx, conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *ChatService) ListConversations(ctx context.Context, userID bson.ObjectID, projectID string) ([]*models.Conversation, error) {
	filter := db.WithNotDeleted(bson.M{
		"user_id":    userID,
		"project_id": projectID,
	})
	opts := options.Find().
		SetProjection(bson.M{
			"inapp_chat_history":  0,
			"openai_chat_history": 0,
		}).
		SetSort(bson.M{"updated_at": -1}).
		SetLimit(50)
	cursor, err := s.conversationCollection.Find(ctx, filter, opts)
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

func (s *ChatService) GetConversation(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) (*models.Conversation, error) {
	conversation := &models.Conversation{}
	filter := db.WithNotDeleted(bson.M{
		"_id":     conversationID,
		"user_id": userID,
	})
	err := s.conversationCollection.FindOne(ctx, filter).Decode(conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *ChatService) UpdateConversation(ctx context.Context, conversation *models.Conversation) error {
	conversation.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	filter := db.WithNotDeleted(bson.M{"_id": conversation.ID})
	// Use WithoutCancel to ensure the write completes even if the user disconnects
	writeCtx := context.WithoutCancel(ctx)
	_, err := s.conversationCollection.UpdateOne(writeCtx, filter, bson.M{"$set": conversation})
	return err
}

func (s *ChatService) DeleteConversation(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) error {
	now := bson.NewDateTimeFromTime(time.Now())
	filter := db.WithNotDeleted(bson.M{
		"_id":     conversationID,
		"user_id": userID,
	})
	_, err := s.conversationCollection.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"deleted_at": now, "updated_at": now}})
	return err
}
