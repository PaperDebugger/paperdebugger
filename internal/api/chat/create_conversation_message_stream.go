package chat

import (
	"context"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/google/uuid"
	"github.com/openai/openai-go/v2/responses"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"google.golang.org/protobuf/encoding/protojson"
)

func (s *ChatServerV1) sendStreamError(stream chatv1.ChatService_CreateConversationMessageStreamServer, err error) error {
	return stream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamError{
			StreamError: &chatv1.StreamError{
				ErrorMessage: err.Error(),
			},
		},
	})
}

// 设计理念：
// 发送给 GPT 之前，消息列表已经构造进 Conversation 对象中（也保存在数据库里）
// 我们发送给 GPT 的就是从数据库里拿到的 Conversation 对象里面的内容（InputItemList）

// buildUserMessage constructs both the user-facing message and the OpenAI input message
func (s *ChatServerV1) buildUserMessage(ctx context.Context, userMessage, userSelectedText string, conversationType chatv1.ConversationType) (*chatv1.Message, *responses.ResponseInputItemUnionParam, error) {
	userPrompt, err := s.chatServiceV1.GetPrompt(ctx, userMessage, userSelectedText, conversationType)
	if err != nil {
		return nil, nil, err
	}

	var inappMessage *chatv1.Message
	switch conversationType {
	case chatv1.ConversationType_CONVERSATION_TYPE_DEBUG:
		inappMessage = &chatv1.Message{
			MessageId: "pd_msg_user_" + uuid.New().String(),
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: userPrompt,
					},
				},
			},
		}
	default:
		inappMessage = &chatv1.Message{
			MessageId: "pd_msg_user_" + uuid.New().String(),
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content:      userMessage,
						SelectedText: &userSelectedText,
					},
				},
			},
		}
	}

	openaiMessage := &responses.ResponseInputItemUnionParam{
		OfInputMessage: &responses.ResponseInputItemMessageParam{
			Role: "user",
			Content: responses.ResponseInputMessageContentListParam{
				responses.ResponseInputContentParamOfInputText(userPrompt),
			},
		},
	}

	return inappMessage, openaiMessage, nil
}

// buildSystemMessage constructs both the user-facing system message and the OpenAI input message
func (s *ChatServerV1) buildSystemMessage(systemPrompt string) (*chatv1.Message, *responses.ResponseInputItemUnionParam) {
	inappMessage := &chatv1.Message{
		MessageId: "pd_msg_system_" + uuid.New().String(),
		Payload: &chatv1.MessagePayload{
			MessageType: &chatv1.MessagePayload_System{
				System: &chatv1.MessageTypeSystem{
					Content: systemPrompt,
				},
			},
		},
	}

	openaiMessage := &responses.ResponseInputItemUnionParam{
		OfInputMessage: &responses.ResponseInputItemMessageParam{
			Role: "system",
			Content: responses.ResponseInputMessageContentListParam{
				responses.ResponseInputContentParamOfInputText(systemPrompt),
			},
		},
	}

	return inappMessage, openaiMessage
}

// convertToBSON converts a protobuf message to BSON
func convertToBSON(msg *chatv1.Message) (bson.M, error) {
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

// 创建对话并写入数据库
// 返回 Conversation 对象
func (s *ChatServerV1) createConversation(
	ctx context.Context,
	userId bson.ObjectID,
	projectId string,
	latexFullSource string,
	projectInstructions string,
	userInstructions string,
	userMessage string,
	userSelectedText string,
	modelSlug string,
	conversationType chatv1.ConversationType,
) (*models.Conversation, error) {
	systemPrompt, err := s.chatServiceV1.GetSystemPrompt(ctx, latexFullSource, projectInstructions, userInstructions, conversationType)
	if err != nil {
		return nil, err
	}

	_, openaiSystemMsg := s.buildSystemMessage(systemPrompt)
	inappUserMsg, openaiUserMsg, err := s.buildUserMessage(ctx, userMessage, userSelectedText, conversationType)
	if err != nil {
		return nil, err
	}

	messages := []*chatv1.Message{inappUserMsg}
	oaiHistory := responses.ResponseNewParamsInputUnion{
		OfInputItemList: responses.ResponseInputParam{*openaiSystemMsg, *openaiUserMsg},
	}

	return s.chatServiceV1.InsertConversationToDB(
		ctx, userId, projectId, modelSlug, messages, oaiHistory.OfInputItemList,
	)
}

// 追加消息到对话并写入数据库
// 返回 Conversation 对象
func (s *ChatServerV1) appendConversationMessage(
	ctx context.Context,
	userId bson.ObjectID,
	conversationId string,
	userMessage string,
	userSelectedText string,
	conversationType chatv1.ConversationType,
) (*models.Conversation, error) {
	objectID, err := bson.ObjectIDFromHex(conversationId)
	if err != nil {
		return nil, err
	}

	conversation, err := s.chatServiceV1.GetConversation(ctx, userId, objectID)
	if err != nil {
		return nil, err
	}

	userMsg, userOaiMsg, err := s.buildUserMessage(ctx, userMessage, userSelectedText, conversationType)
	if err != nil {
		return nil, err
	}

	bsonMsg, err := convertToBSON(userMsg)
	if err != nil {
		return nil, err
	}
	conversation.InappChatHistory = append(conversation.InappChatHistory, bsonMsg)
	conversation.OpenaiChatHistory = append(conversation.OpenaiChatHistory, *userOaiMsg)

	if err := s.chatServiceV1.UpdateConversation(conversation); err != nil {
		return nil, err
	}

	return conversation, nil
}

// 如果 conversationId 是 ""， 就创建新对话，否则就追加消息到对话
// conversationType 可以在一次 conversation 中多次切换
func (s *ChatServerV1) prepare(ctx context.Context, projectId string, conversationId string, userMessage string, userSelectedText string, modelSlug string, conversationType chatv1.ConversationType) (context.Context, *models.Conversation, *models.Settings, error) {
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
	case chatv1.ConversationType_CONVERSATION_TYPE_DEBUG:
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
			conversationType,
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

func (s *ChatServerV1) CreateConversationMessageStream(
	req *chatv1.CreateConversationMessageStreamRequest,
	stream chatv1.ChatService_CreateConversationMessageStreamServer,
) error {
	ctx := stream.Context()

	modelSlug := req.GetModelSlug()
	if modelSlug == "" {
		modelSlug = models.LanguageModel(req.GetLanguageModel()).Name()
	}

	ctx, conversation, settings, err := s.prepare(
		ctx,
		req.GetProjectId(),
		req.GetConversationId(),
		req.GetUserMessage(),
		req.GetUserSelectedText(),
		modelSlug,
		req.GetConversationType(),
	)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// 用法跟 ChatCompletion 一样，只是传递了 stream 参数
	llmProvider := &models.LLMProviderConfig{
		APIKey: settings.OpenAIAPIKey,
	}

	openaiChatHistory, inappChatHistory, err := s.aiClientV1.ChatCompletionStreamV1(ctx, stream, conversation.ID.Hex(), modelSlug, conversation.OpenaiChatHistory, llmProvider)
	if err != nil {
		return s.sendStreamError(stream, err)
	}

	// 附加消息到对话
	bsonMessages := make([]bson.M, len(inappChatHistory))
	for i := range inappChatHistory {
		bsonMsg, err := convertToBSON(&inappChatHistory[i])
		if err != nil {
			return s.sendStreamError(stream, err)
		}
		bsonMessages[i] = bsonMsg
	}
	conversation.InappChatHistory = append(conversation.InappChatHistory, bsonMessages...)
	conversation.OpenaiChatHistory = openaiChatHistory
	if err := s.chatServiceV1.UpdateConversation(conversation); err != nil {
		return s.sendStreamError(stream, err)
	}

	if conversation.Title == services.DefaultConversationTitle {
		go func() {
			protoMessages := make([]*chatv1.Message, len(conversation.InappChatHistory))
			for i, bsonMsg := range conversation.InappChatHistory {
				protoMessages[i] = mapper.BSONToChatMessage(bsonMsg)
			}
			title, err := s.aiClientV1.GetConversationTitle(ctx, protoMessages, llmProvider)
			if err != nil {
				s.logger.Error("Failed to get conversation title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
			conversation.Title = title
			if err := s.chatServiceV1.UpdateConversation(conversation); err != nil {
				s.logger.Error("Failed to update conversation with new title", "error", err, "conversationID", conversation.ID.Hex())
				return
			}
		}()
	}

	// The final conversation object is NOT returned
	return nil
}
