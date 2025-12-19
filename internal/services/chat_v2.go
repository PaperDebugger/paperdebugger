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

// Pre-compiled templates for better performance
var (
	systemPromptDefaultTmplV2 *template.Template
	systemPromptDebugTmplV2   *template.Template
	userPromptDefaultTmplV2   *template.Template
	userPromptDebugTmplV2     *template.Template
)

func init() {
	systemPromptDefaultTmplV2 = template.Must(template.New("system_default_v2").Parse(systemPromptDefaultTemplateV2))
	systemPromptDebugTmplV2 = template.Must(template.New("system_debug_v2").Parse(systemPromptDebugTemplateV2))
	userPromptDefaultTmplV2 = template.Must(template.New("user_default_v2").Parse(userPromptDefaultTemplateV2))
	userPromptDebugTmplV2 = template.Must(template.New("user_debug_v2").Parse(userPromptDebugTemplateV2))
}

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
	var tmpl *template.Template
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		tmpl = systemPromptDebugTmplV2
	default:
		tmpl = systemPromptDefaultTmplV2
	}

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

func (s *ChatServiceV2) GetPrompt(ctx context.Context, content string, selectedText string, surrounding string, conversationType chatv2.ConversationType) (string, error) {
	var tmpl *template.Template
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		tmpl = userPromptDebugTmplV2
	default:
		tmpl = userPromptDefaultTmplV2
	}

	var userPromptBuffer bytes.Buffer
	if err := tmpl.Execute(&userPromptBuffer, map[string]string{
		"UserInput":    content,
		"SelectedText": selectedText,
		"Surrounding":  surrounding,
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
	filter := db.MergeFilters(
		bson.M{"user_id": userID, "project_id": projectID},
		db.NotDeleted(),
	)
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
	filter := db.MergeFilters(
		bson.M{"_id": conversationID, "user_id": userID},
		db.NotDeleted(),
	)
	err := s.conversationCollection.FindOne(ctx, filter).Decode(conversation)
	if err != nil {
		return nil, err
	}
	return conversation, nil
}

func (s *ChatServiceV2) UpdateConversationV2(conversation *models.Conversation) error {
	conversation.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	filter := db.MergeFilters(
		bson.M{"_id": conversation.ID},
		db.NotDeleted(),
	)
	_, err := s.conversationCollection.UpdateOne(
		context.Background(),
		filter,
		bson.M{"$set": conversation},
	)
	return err
}

func (s *ChatServiceV2) UpdateConversationTitleV2(ctx context.Context, conversationID bson.ObjectID, title string) error {
	filter := db.MergeFilters(
		bson.M{"_id": conversationID},
		db.NotDeleted(),
	)
	now := bson.NewDateTimeFromTime(time.Now())
	_, err := s.conversationCollection.UpdateOne(
		ctx,
		filter,
		bson.M{"$set": bson.M{"title": title, "updated_at": now}},
	)
	return err
}

func (s *ChatServiceV2) DeleteConversationV2(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) error {
	now := bson.NewDateTimeFromTime(time.Now())
	filter := db.MergeFilters(
		bson.M{"_id": conversationID, "user_id": userID},
		db.NotDeleted(),
	)
	_, err := s.conversationCollection.UpdateOne(
		ctx,
		filter,
		bson.M{"$set": bson.M{"deleted_at": now, "updated_at": now}},
	)
	return err
}
