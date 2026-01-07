package chat

import (
	"context"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/google/uuid"
	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"google.golang.org/protobuf/encoding/protojson"
)

func (s *ChatServerV2) sendStreamError(stream chatv2.ChatService_CreateConversationMessageStreamServer, err error) error {
	return stream.Send(&chatv2.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv2.CreateConversationMessageStreamResponse_StreamError{
			StreamError: &chatv2.StreamError{
				ErrorMessage: err.Error(),
			},
		},
	})
}

// Design philosophy:
// Before sending to GPT, the message list is already constructed in the Conversation object (also saved in the database)
// What we send to GPT is the content (InputItemList) from the Conversation object retrieved from the database

// buildUserMessage constructs both the user-facing message and the OpenAI input message
func (s *ChatServerV2) buildSystemMessage(systemPrompt string) (*chatv2.Message, openai.ChatCompletionMessageParamUnion) {
	inappMessage := &chatv2.Message{
		MessageId: "pd_msg_system_" + uuid.New().String(),
		Payload: &chatv2.MessagePayload{
			MessageType: &chatv2.MessagePayload_System{
				System: &chatv2.MessageTypeSystem{
					Content: systemPrompt,
				},
			},
		},
	}

	openaiMessage := openai.SystemMessage(systemPrompt)

	return inappMessage, openaiMessage
}

func (s *ChatServerV2) buildUserMessage(ctx context.Context, userMessage, userSelectedText, surrounding string, conversationType chatv2.ConversationType) (*chatv2.Message, openai.ChatCompletionMessageParamUnion, error) {
	userPrompt, err := s.chatServiceV2.GetPrompt(ctx, userMessage, userSelectedText, surrounding, conversationType)
	if err != nil {
		return nil, openai.ChatCompletionMessageParamUnion{}, err
	}

	var inappMessage *chatv2.Message
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		inappMessage = &chatv2.Message{
			MessageId: "pd_msg_user_" + uuid.New().String(),
			Payload: &chatv2.MessagePayload{
				MessageType: &chatv2.MessagePayload_User{
					User: &chatv2.MessageTypeUser{
						Content: userPrompt,
					},
				},
			},
		}
	default:
		inappMessage = &chatv2.Message{
			MessageId: "pd_msg_user_" + uuid.New().String(),
			Payload: &chatv2.MessagePayload{
				MessageType: &chatv2.MessagePayload_User{
					User: &chatv2.MessageTypeUser{
						Content:      userMessage,
						SelectedText: &userSelectedText,
						Surrounding:  &surrounding,
					},
				},
			},
		}
	}

	openaiMessage := openai.UserMessage(userPrompt)
	return inappMessage, openaiMessage, nil
}

// convertToBSON converts a protobuf message to BSON
func convertToBSONV2(msg *chatv2.Message) (bson.M, error) {
	jsonBytes, err := protojson.Marshal(msg)
	if err != nil {
		return nil, err
	}
	var bsonMsg bson.M
	if err := bson.UnmarshalExtJSON(jsonBytes, true, &bsonMsg); err != nil {
		return nil, err
	}
	return bsonMsg, nil
}

// createConversation creates a conversation and writes it to the database
// Returns the Conversation object
func (s *ChatServerV2) createConversation(
	ctx context.Context,
	userId bson.ObjectID,
	projectId string,
	latexFullSource string,
	projectInstructions string,
	userInstructions string,
	userMessage string,
	userSelectedText string,
	surrounding string,
	modelSlug string,
	conversationType chatv2.ConversationType,
) (*models.Conversation, error) {
	systemPrompt, err := s.chatServiceV2.GetSystemPromptV2(ctx, latexFullSource, projectInstructions, userInstructions, conversationType)
	if err != nil {
		return nil, err
	}

	_, openaiSystemMsg := s.buildSystemMessage(systemPrompt)
	inappUserMsg, openaiUserMsg, err := s.buildUserMessage(ctx, userMessage, userSelectedText, surrounding, conversationType)
	if err != nil {
		return nil, err
	}

	messages := []*chatv2.Message{inappUserMsg}
	oaiHistory := []openai.ChatCompletionMessageParamUnion{
		openaiSystemMsg,
		openaiUserMsg,
	}

	return s.chatServiceV2.InsertConversationToDBV2(
		ctx, userId, projectId, modelSlug, messages, oaiHistory,
	)
}

// appendConversationMessage appends a message to the conversation and writes it to the database
// Returns the Conversation object
func (s *ChatServerV2) appendConversationMessage(
	ctx context.Context,
	userId bson.ObjectID,
	conversationId string,
	userMessage string,
	userSelectedText string,
	surrounding string,
	conversationType chatv2.ConversationType,
	parentMessageId string,
) (*models.Conversation, error) {
	objectID, err := bson.ObjectIDFromHex(conversationId)
	if err != nil {
		return nil, err
	}

	conversation, err := s.chatServiceV2.GetConversationV2(ctx, userId, objectID)
	if err != nil {
		return nil, err
	}

	// Handle branching / edit mode
	if parentMessageId != "" {
		if parentMessageId == "root" {
			// Clear all history, keep only the system message (first element) of OpenaiChatHistoryCompletion
			conversation.InappChatHistory = []bson.M{}
			if len(conversation.OpenaiChatHistoryCompletion) > 0 {
				conversation.OpenaiChatHistoryCompletion = conversation.OpenaiChatHistoryCompletion[:1]
			} else {
				// Should not happen, but safe fallback
				conversation.OpenaiChatHistoryCompletion = []openai.ChatCompletionMessageParamUnion{}
			}
		} else {
			// Find parent message and truncate after it
			foundIndex := -1
			for i, msg := range conversation.InappChatHistory {
				// msg["message_id"] matches parentMessageId
				// BSON M maps to map[string]interface{}, message_id should be string
				if id, ok := msg["message_id"].(string); ok && id == parentMessageId {
					foundIndex = i
					break
				}
			}

			if foundIndex != -1 {
				// Truncate InappChatHistory to include the parent message
				conversation.InappChatHistory = conversation.InappChatHistory[:foundIndex+1]

				// Truncate OpenaiChatHistoryCompletion
				// Map index: Inapp[i] -> Openai[i+1] (because Openai[0] is system)
				// So we want to keep up to foundIndex + 1 (which corresponds to foundIndex in Inapp)
				// The slice end is exclusive, so we slice up to (foundIndex + 1) + 1 = foundIndex + 2
				if len(conversation.OpenaiChatHistoryCompletion) > foundIndex+1 {
					conversation.OpenaiChatHistoryCompletion = conversation.OpenaiChatHistoryCompletion[:foundIndex+2]
				}
			} else {
				// Parent message not found, maybe ignore or error?
				// For now, let's log a warning and append (linear behavior fallback) or maybe error is better.
				// s.logger.Warn("Parent message not found during edit", "parentMessageId", parentMessageId)
				// Actually, throwing error is safer to avoid confusing state
				return nil, shared.ErrBadRequest("Parent message not found")
			}
		}
	}

	userMsg, userOaiMsg, err := s.buildUserMessage(ctx, userMessage, userSelectedText, surrounding, conversationType)
	if err != nil {
		return nil, err
	}

	bsonMsg, err := convertToBSONV2(userMsg)
	if err != nil {
		return nil, err
	}
	conversation.InappChatHistory = append(conversation.InappChatHistory, bsonMsg)
	conversation.OpenaiChatHistoryCompletion = append(conversation.OpenaiChatHistoryCompletion, userOaiMsg)

	if err := s.chatServiceV2.UpdateConversationV2(conversation); err != nil {
		return nil, err
	}

	return conversation, nil
}

// prepare creates a new conversation if conversationId is "", otherwise appends a message to the conversation
// conversationType can be switched multiple times within a single conversation
func (s *ChatServerV2) prepare(ctx context.Context, projectId string, conversationId string, userMessage string, userSelectedText string, surrounding string, modelSlug string, conversationType chatv2.ConversationType, parentMessageId string) (context.Context, *models.Conversation, *models.Settings, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return ctx, nil, nil, err
	}

	project, err := s.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil && err != mongo.ErrNoDocuments {
		return ctx, nil, nil, err
	}

	userInstructions, err := s.userService.GetUserInstructions(ctx, actor.ID)
	if err != nil {
		return ctx, nil, nil, err
	}

	var latexFullSource string
	switch conversationType {
	case chatv2.ConversationType_CONVERSATION_TYPE_DEBUG:
		latexFullSource = "latex_full_source is not available in debug mode"
	default:
		if project == nil || project.IsOutOfDate() {
			return ctx, nil, nil, shared.ErrProjectOutOfDate("project is out of date")
		}

		latexFullSource, err = project.GetFullContent()
		if err != nil {
			return ctx, nil, nil, err
		}
	}

	var conversation *models.Conversation

	if conversationId == "" {
		conversation, err = s.createConversation(
			ctx,
			actor.ID,
			projectId,
			latexFullSource,
			project.Instructions,
			userInstructions,
			userMessage,
			userSelectedText,
			surrounding,
			modelSlug,
			conversationType,
		)
	} else {
		conversation, err = s.appendConversationMessage(
			ctx,
			actor.ID,
			conversationId,
			userMessage,
			userSelectedText,
			surrounding,
			conversationType,
			parentMessageId,
		)
	}

	if err != nil {
		return ctx, nil, nil, err
	}

	ctx = contextutil.SetProjectID(ctx, conversation.ProjectID)
	ctx = contextutil.SetConversationID(ctx, conversation.ID.Hex())

	settings, err := s.userService.GetUserSettings(ctx, actor.ID)
	if err != nil {
		return ctx, conversation, nil, err
	}

	return ctx, conversation, settings, nil
}

func (s *ChatServerV2) CreateConversationMessageStream(
	req *chatv2.CreateConversationMessageStreamRequest,
	stream chatv2.ChatService_CreateConversationMessageStreamServer,
) error {
	ctx := stream.Context()

	modelSlug := req.GetModelSlug()
	ctx, conversation, settings, err := s.prepare(
		ctx,
		req.GetProjectId(),
		req.GetConversationId(),
		req.GetUserMessage(),
		req.GetUserSelectedText(),

		req.GetSurrounding(),
		modelSlug,
		req.GetConversationType(),
		req.GetParentMessageId(),
	)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// Usage is the same as ChatCompletion, just passing the stream parameter
	llmProvider := &models.LLMProviderConfig{
		APIKey: settings.OpenAIAPIKey,
	}

	openaiChatHistory, inappChatHistory, err := s.aiClientV2.ChatCompletionStreamV2(ctx, stream, conversation.ID.Hex(), modelSlug, conversation.OpenaiChatHistoryCompletion, llmProvider)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// Append messages to the conversation
	bsonMessages := make([]bson.M, len(inappChatHistory))
	for i := range inappChatHistory {
		bsonMsg, err := convertToBSONV2(&inappChatHistory[i])
		if err != nil {
			return s.sendStreamError(stream, err)
		}
		bsonMessages[i] = bsonMsg
	}
	conversation.InappChatHistory = append(conversation.InappChatHistory, bsonMessages...)
	conversation.OpenaiChatHistoryCompletion = openaiChatHistory
	if err := s.chatServiceV2.UpdateConversationV2(conversation); err != nil {
		return s.sendStreamError(stream, err)
	}

	if conversation.Title == services.DefaultConversationTitle {
		go func() {
			protoMessages := make([]*chatv2.Message, len(conversation.InappChatHistory))
			for i, bsonMsg := range conversation.InappChatHistory {
				protoMessages[i] = mapper.BSONToChatMessageV2(bsonMsg)
			}
			title, err := s.aiClientV2.GetConversationTitleV2(ctx, protoMessages, llmProvider)
			if err != nil {
				s.logger.Error("Failed to get conversation title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
			conversation.Title = title
			if err := s.chatServiceV2.UpdateConversationV2(conversation); err != nil {
				s.logger.Error("Failed to update conversation with new title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
		}()
	}

	// The final conversation object is NOT returned
	return nil
}
