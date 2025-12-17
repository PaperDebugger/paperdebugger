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
	"github.com/openai/openai-go/v3"
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

// define default conversation title
const DefaultConversationTitle = "New Conversation ."

func NewChatService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *ChatService {
	base := NewBaseService(db, cfg, logger)
	return &ChatService{
		BaseService:            base,
		conversationCollection: base.db.Collection((models.Conversation{}).CollectionName()),
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

func (s *ChatService) InsertConversationToDB(ctx context.Context, userID bson.ObjectID, projectID string, modelSlug string, inappChatHistory []*chatv1.Message, openaiChatHistory []openai.ChatCompletionMessageParamUnion) (*models.Conversation, error) {
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

	// Compatible Layer Begins
	languageModel := models.LanguageModel(0).FromSlug(modelSlug)
	// Compatible Layer Ends

	conversation := &models.Conversation{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: bson.NewDateTimeFromTime(time.Now()),
			UpdatedAt: bson.NewDateTimeFromTime(time.Now()),
		},
		UserID:                      userID,
		ProjectID:                   projectID,
		Title:                       DefaultConversationTitle,
		LanguageModel:               languageModel,
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

func (s *ChatService) ListConversations(ctx context.Context, userID bson.ObjectID, projectID string) ([]*models.Conversation, error) {
	filter := bson.M{
		"user_id":    userID,
		"project_id": projectID,
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}
	opts := options.Find().
		SetProjection(bson.M{ // exclude these fields
			"inapp_chat_history":             0,
			"openai_chat_history":            0,
			"openai_chat_history_completion": 0,
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

// migrateResponseInputToCompletion converts old Responses API format (v2) to Chat Completion API format (v3).
// This is used for lazy migration of existing conversations.
func migrateResponseInputToCompletion(oldHistory responses.ResponseInputParam) []openai.ChatCompletionMessageParamUnion {
	result := make([]openai.ChatCompletionMessageParamUnion, 0, len(oldHistory))

	for _, item := range oldHistory {
		// Handle EasyInputMessage (simple user/assistant/system messages)
		if item.OfMessage != nil {
			msg := item.OfMessage
			content := ""
			if msg.Content.OfString.Valid() {
				content = msg.Content.OfString.Value
			}

			switch msg.Role {
			case responses.EasyInputMessageRoleUser:
				result = append(result, openai.UserMessage(content))
			case responses.EasyInputMessageRoleAssistant:
				result = append(result, openai.AssistantMessage(content))
			case responses.EasyInputMessageRoleSystem:
				result = append(result, openai.SystemMessage(content))
			}
			continue
		}

		// Handle ResponseInputItemMessageParam (detailed input message)
		if item.OfInputMessage != nil {
			msg := item.OfInputMessage
			// Extract text content from the message
			var textContent string
			for _, contentItem := range msg.Content {
				if contentItem.OfInputText != nil {
					textContent += contentItem.OfInputText.Text
				}
			}
			if msg.Role == "user" {
				result = append(result, openai.UserMessage(textContent))
			}
			continue
		}

		// Handle ResponseOutputMessageParam (assistant output)
		if item.OfOutputMessage != nil {
			msg := item.OfOutputMessage
			var textContent string
			for _, contentItem := range msg.Content {
				if contentItem.OfOutputText != nil {
					textContent += contentItem.OfOutputText.Text
				}
			}
			result = append(result, openai.AssistantMessage(textContent))
			continue
		}

		// Handle FunctionCall (tool call from assistant)
		if item.OfFunctionCall != nil {
			fc := item.OfFunctionCall
			result = append(result, openai.ChatCompletionMessageParamUnion{
				OfAssistant: &openai.ChatCompletionAssistantMessageParam{
					Role: "assistant",
					ToolCalls: []openai.ChatCompletionMessageToolCallUnionParam{
						{
							OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
								ID: fc.CallID,
								Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
									Name:      fc.Name,
									Arguments: fc.Arguments,
								},
							},
						},
					},
				},
			})
			continue
		}

		// Handle FunctionCallOutput (tool response)
		if item.OfFunctionCallOutput != nil {
			fco := item.OfFunctionCallOutput
			result = append(result, openai.ToolMessage(fco.Output, fco.CallID))
			continue
		}

		// Other types (Reasoning, WebSearch, etc.) are skipped as they don't have direct equivalents
	}

	return result
}

func (s *ChatService) GetConversation(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) (*models.Conversation, error) {
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

	// Lazy migration: convert old OpenaiChatHistory to new OpenaiChatHistoryCompletion
	if len(conversation.OpenaiChatHistoryCompletion) == 0 && len(conversation.OpenaiChatHistory) > 0 {
		conversation.OpenaiChatHistoryCompletion = migrateResponseInputToCompletion(conversation.OpenaiChatHistory)
		// Async update to database
		go func() {
			if err := s.UpdateConversation(conversation); err != nil {
				s.logger.Error("Failed to migrate conversation chat history", "error", err, "conversationID", conversationID.Hex())
			} else {
				s.logger.Info("Successfully migrated conversation chat history", "conversationID", conversationID.Hex())
			}
		}()
	}

	return conversation, nil
}

func (s *ChatService) UpdateConversation(conversation *models.Conversation) error {
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

func (s *ChatService) DeleteConversation(ctx context.Context, userID bson.ObjectID, conversationID bson.ObjectID) error {
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
