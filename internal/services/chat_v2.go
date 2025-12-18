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
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"google.golang.org/protobuf/encoding/protojson"
)

//go:embed system_prompt_default.tmpl
var systemPromptDefaultTemplateV2 string

//go:embed system_prompt_debug.tmpl
var systemPromptDebugTemplateV2 string

//go:embed user_prompt_default.tmpl
var userPromptDefaultTemplateV2 string

//go:embed user_prompt_debug.tmpl
var userPromptDebugTemplateV2 string

type ChatServiceV2 struct {
	BaseService
	conversationCollection *mongo.Collection
}

// define default conversation title
const DefaultConversationTitleV2 = "New Conversation ."

func NewChatServiceV2(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *ChatServiceV2 {
	base := NewBaseService(db, cfg, logger)
	return &ChatServiceV2{
		BaseService:            base,
		conversationCollection: base.db.Collection((models.Conversation{}).CollectionName()),
	}
}

func (s *ChatServiceV2) GetSystemPromptV2(ctx context.Context, fullContent string, projectInstructions string, userInstructions string, conversationType chatv2.ConversationType) (string, error) {
	var systemPromptString string
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		systemPromptString = systemPromptDebugTemplateV2
	default:
		systemPromptString = systemPromptDefaultTemplateV2
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

func (s *ChatServiceV2) GetPrompt(ctx context.Context, content string, selectedText string, conversationType chatv2.ConversationType) (string, error) {
	var userPromptString string
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		userPromptString = userPromptDebugTemplateV2
	default:
		userPromptString = userPromptDefaultTemplateV2
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

func (s *ChatServiceV2) InsertConversationToDBV2(ctx context.Context, userID bson.ObjectID, projectID string, modelSlug string, inappChatHistory []*chatv2.Message, openaiChatHistory []openai.ChatCompletionMessageParamUnion) (*models.Conversation, error) {
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
		UserID:                      userID,
		ProjectID:                   projectID,
		Title:                       DefaultConversationTitleV2,
		ModelSlug:                   modelSlug,
		InappChatHistory:            bsonMessages,
		OpenaiChatHistoryCompletion: openaiChatHistory,
	}
	_, err := s.conversationCollection.InsertOne(ctx, conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *ChatServiceV2) ListConversationsV2(ctx context.Context, userID bson.ObjectID, projectID string) ([]*models.Conversation, error) {
	filter := bson.M{
		"user_id":    userID,
		"project_id": projectID,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}
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

func (s *ChatServiceV2) GetConversationV2(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) (*models.Conversation, error) {
	conversation := &models.Conversation{}
	err := s.conversationCollection.FindOne(ctx, bson.M{
		"_id":     conversationID,
		"user_id": userID,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}).Decode(conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *ChatServiceV2) UpdateConversationV2(conversation *models.Conversation) error {
	conversation.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	_, err := s.conversationCollection.UpdateOne(
		context.Background(),
		bson.M{
			"_id": conversation.ID,
			"$or": []bson.M{
				{"deleted_at": nil},
				{"deleted_at": bson.M{"$exists": false}},
			},
		},
		bson.M{"$set": conversation},
	)
	return err
}

func (s *ChatServiceV2) DeleteConversationV2(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) error {
	now := bson.NewDateTimeFromTime(time.Now())
	_, err := s.conversationCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":     conversationID,
			"user_id": userID,
			"$or": []bson.M{
				{"deleted_at": nil},
				{"deleted_at": bson.M{"$exists": false}},
			},
		},
		bson.M{"$set": bson.M{"deleted_at": now, "updated_at": now}},
	)
	return err
}
