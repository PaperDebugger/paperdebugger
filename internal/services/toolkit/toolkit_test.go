package toolkit_test

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/client"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/google/uuid"
	"github.com/openai/openai-go/v2/responses"
	"github.com/stretchr/testify/assert"
)

var mockConversationId = "mock-conversation-id"

type mockCallbackStream struct {
	chatv1.ChatService_CreateConversationMessageStreamServer
	messages []*chatv1.CreateConversationMessageStreamResponse
	// 用于跟踪消息状态的栈
	messageStack map[string]bool // key: message_id, value: true if begin, false if end
	// 用于跟踪流的状态
	hasInitialization bool
	hasFinalization   bool
	// 用于跟踪当前活跃的assistant消息
	activeAssistantMessageId string
}

func (m *mockCallbackStream) Send(response *chatv1.CreateConversationMessageStreamResponse) error {
	if m.messageStack == nil {
		m.messageStack = make(map[string]bool)
	}

	// 处理流初始化
	if response.GetStreamInitialization() != nil {
		if m.hasInitialization {
			return fmt.Errorf("duplicate stream_initialization")
		}
		m.hasInitialization = true
		m.messages = append(m.messages, response)
		return nil
	}

	// 处理流结束
	if response.GetStreamFinalization() != nil {
		if !m.hasInitialization {
			return fmt.Errorf("stream_finalization without stream_initialization")
		}
		if len(m.messageStack) > 0 {
			return fmt.Errorf("stream_finalization with unclosed message parts: %v", m.messageStack)
		}
		m.hasFinalization = true
		m.messages = append(m.messages, response)
		return nil
	}

	// 获取消息ID
	var messageId string
	switch {
	case response.GetStreamPartBegin() != nil:
		begin := response.GetStreamPartBegin()
		messageId = begin.MessageId
		m.messageStack[messageId] = true

		// 如果是assistant role，记录当前活跃的assistant消息ID
		if begin.GetPayload().GetAssistant() != nil {
			m.activeAssistantMessageId = messageId
		}

	case response.GetStreamPartEnd() != nil:
		end := response.GetStreamPartEnd()
		messageId = end.MessageId
		if !m.messageStack[messageId] {
			return fmt.Errorf("stream_part_end without matching stream_part_begin for message_id: %s", messageId)
		}
		delete(m.messageStack, messageId)

		// 如果是结束当前活跃的assistant消息，清除活跃ID
		if messageId == m.activeAssistantMessageId {
			m.activeAssistantMessageId = ""
		}

	case response.GetMessageChunk() != nil:
		chunk := response.GetMessageChunk()
		if m.activeAssistantMessageId == "" {
			return fmt.Errorf("message_chunk without active assistant message")
		}
		if chunk.MessageId != m.activeAssistantMessageId {
			return fmt.Errorf("message_chunk with wrong message_id: got %s, want %s",
				chunk.MessageId, m.activeAssistantMessageId)
		}
	}

	m.messages = append(m.messages, response)
	fmt.Printf("Response: %+v\n", response)
	return nil
}

func (m *mockCallbackStream) GetMessages() []*chatv1.CreateConversationMessageStreamResponse {
	return m.messages
}

func (m *mockCallbackStream) ValidateMessageStack() error {
	if !m.hasInitialization {
		return fmt.Errorf("missing stream_initialization")
	}
	if !m.hasFinalization {
		return fmt.Errorf("missing stream_finalization")
	}
	if len(m.messageStack) > 0 {
		return fmt.Errorf("unclosed message parts: %v", m.messageStack)
	}
	if m.activeAssistantMessageId != "" {
		return fmt.Errorf("unclosed assistant message: %s", m.activeAssistantMessageId)
	}
	return nil
}

func createOpenaiUserInputMessage(prompt string) responses.ResponseInputItemUnionParam {
	return responses.ResponseInputItemUnionParam{
		OfInputMessage: &responses.ResponseInputItemMessageParam{
			Role: "user",
			Content: responses.ResponseInputMessageContentListParam{
				responses.ResponseInputContentParamOfInputText(prompt),
			},
		},
	}
}

func createAppUserInputMessage(prompt string) chatv1.Message {
	return chatv1.Message{
		MessageId: "pd_user_" + uuid.New().String(),
		Payload: &chatv1.MessagePayload{
			MessageType: &chatv1.MessagePayload_User{
				User: &chatv1.MessageTypeUser{
					Content: prompt,
				},
			},
		},
	}
}

func TestChatCompletion_SingleRoundChat_NotCallTool(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	testCases := []struct {
		name           string
		useStream      bool
		streamServer   mockCallbackStream
		conversationId string
	}{
		{
			name:      "Non-streaming",
			useStream: false,
		},
		{
			name:           "Streaming",
			useStream:      true,
			streamServer:   mockCallbackStream{},
			conversationId: mockConversationId,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			prompt := "Hi, how are you? Please respond me with 'I'm fine, thank you.' and no other words."
			var oaiHistory = []responses.ResponseInputItemUnionParam{createOpenaiUserInputMessage(prompt)}
			var appHistory = []chatv1.Message{createAppUserInputMessage(prompt)}

			var _oai []responses.ResponseInputItemUnionParam
			var _inapp []chatv1.Message
			var err error

			if tc.useStream {
				_oai, _inapp, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				_oai, _inapp, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)

			oaiHistory = _oai
			appHistory = append(appHistory, _inapp...)

			assert.Equal(t, len(oaiHistory), len(appHistory))
			assert.Equal(t, "I'm fine, thank you.", oaiHistory[1].OfOutputMessage.Content[0].OfOutputText.Text)
			assert.Equal(t, "I'm fine, thank you.", appHistory[1].Payload.GetAssistant().GetContent())
		})
	}
}

func TestChatCompletion_TwoRoundChat_NotCallTool(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	testCases := []struct {
		name           string
		useStream      bool
		streamServer   mockCallbackStream
		conversationId string
	}{
		{
			name:      "Non-streaming",
			useStream: false,
		},
		{
			name:           "Streaming",
			useStream:      true,
			streamServer:   mockCallbackStream{},
			conversationId: mockConversationId,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			prompt := "Hi, I'm Jack, what's your name? (Do not call any tool)"
			var oaiHistory = []responses.ResponseInputItemUnionParam{createOpenaiUserInputMessage(prompt)}
			var appHistory = []chatv1.Message{createAppUserInputMessage(prompt)}

			var _oaiHistory []responses.ResponseInputItemUnionParam
			var _appHistory []chatv1.Message
			var err error

			if tc.useStream {
				_oaiHistory, _appHistory, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				_oaiHistory, _appHistory, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)
			oaiHistory = _oaiHistory
			appHistory = append(appHistory, _appHistory...)
			assert.Equal(t, len(oaiHistory), len(appHistory))
			assert.Equal(t, len(oaiHistory), 2)

			prompt = "What's my name? answer me 'Your name is NAME!'"
			oaiHistory = append(oaiHistory, createOpenaiUserInputMessage(prompt))
			appHistory = append(appHistory, createAppUserInputMessage(prompt))

			if tc.useStream {
				_oaiHistory, _appHistory, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				_oaiHistory, _appHistory, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)
			oaiHistory = _oaiHistory
			appHistory = append(appHistory, _appHistory...)
			assert.Equal(t, len(oaiHistory), len(appHistory))
			assert.Equal(t, len(oaiHistory), 4)

			assert.Equal(t, "Your name is Jack!", oaiHistory[3].OfOutputMessage.Content[0].OfOutputText.Text)
			assert.Equal(t, "Your name is Jack!", appHistory[3].Payload.GetAssistant().GetContent())
		})
	}
}

func TestChatCompletion_OneRoundChat_CallOneTool_MessageAfterToolCall(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	testCases := []struct {
		name           string
		useStream      bool
		streamServer   mockCallbackStream
		conversationId string
	}{
		{
			name:      "Non-streaming",
			useStream: false,
		},
		{
			name:           "Streaming",
			useStream:      true,
			streamServer:   mockCallbackStream{},
			conversationId: mockConversationId,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			prompt := "Hi, I'm Jack, what's your name? (greet me and do nothing else)"
			var oaiHistory = []responses.ResponseInputItemUnionParam{createOpenaiUserInputMessage(prompt)}
			var appHistory = []chatv1.Message{createAppUserInputMessage(prompt)}

			var openaiHistory []responses.ResponseInputItemUnionParam
			var inappHistory []chatv1.Message
			var err error

			if tc.useStream {
				openaiHistory, inappHistory, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				openaiHistory, inappHistory, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)

			oaiHistory = openaiHistory
			appHistory = append(appHistory, inappHistory...)

			assert.Equal(t, len(oaiHistory), 4)
			assert.Equal(t, len(appHistory), 3) // app history 只保留 tool_call_result，不保留调用之前的那个 tool_call 请求

			assert.NotNil(t, oaiHistory[1].OfFunctionCall)
			assert.Equal(t, oaiHistory[1].OfFunctionCall.Name, "greeting")
			assert.Equal(t, oaiHistory[1].OfFunctionCall.Arguments, "{\"name\":\"Jack\"}")

			assert.Nil(t, oaiHistory[2].OfFunctionCall)
			assert.NotNil(t, oaiHistory[2].OfFunctionCallOutput)

			assert.NotNil(t, oaiHistory[3].OfOutputMessage)
		})
	}
}

// 测试是否可以处理 err 的 message 添加到聊天记录中
func TestChatCompletion_OneRoundChat_CallOneTool_AlwaysException(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	testCases := []struct {
		name           string
		useStream      bool
		streamServer   mockCallbackStream
		conversationId string
	}{
		{
			name:      "Non-streaming",
			useStream: false,
		},
		{
			name:           "Streaming",
			useStream:      true,
			streamServer:   mockCallbackStream{},
			conversationId: mockConversationId,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			prompt := "I want to test the system robust, please call 'always_exception' tool. I'm sure what I'm doing, just call it."
			var oaiHistory = []responses.ResponseInputItemUnionParam{createOpenaiUserInputMessage(prompt)}
			var appHistory = []chatv1.Message{createAppUserInputMessage(prompt)}

			var openaiHistory responses.ResponseInputParam
			var inappHistory []chatv1.Message
			var err error

			if tc.useStream {
				openaiHistory, inappHistory, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				openaiHistory, inappHistory, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)

			oaiHistory = openaiHistory
			// print the openaiHistory
			for _, h := range openaiHistory {
				if h.OfInputMessage != nil {
					fmt.Printf("openaiHistory: %+v\n", h.OfInputMessage.Content[0].OfInputText.Text)
				}
				if h.OfOutputMessage != nil {
					fmt.Printf("openaiHistory: %+v\n", h.OfOutputMessage.Content[0].OfOutputText.Text)
				}
			}
			appHistory = append(appHistory, inappHistory...)

			for _, h := range appHistory {
				fmt.Printf("appHistory: %+v\n", &h)
			}

			assert.Equal(t, 4, len(oaiHistory))
			//pd_user, openai_call, openai_msg 或者 pd_user, openai_msg, openai_call, openai_msg
			assert.Condition(t, func() bool {
				var firstMsg = appHistory[0].MessageId
				if !strings.HasPrefix(firstMsg, "pd_user_") {
					return false
				}
				var secondMsg = appHistory[1].MessageId
				if !strings.HasPrefix(secondMsg, "openai_msg") {
					if !strings.HasPrefix(secondMsg, "openai_call") {
						return false
					}
				}
				var thirdMsg = appHistory[2].MessageId
				if !strings.HasPrefix(thirdMsg, "openai_msg") {
					if !strings.HasPrefix(thirdMsg, "openai_call") {
						return false
					}
				}
				// check the last message should be openai_msg
				var lastMsg = appHistory[len(appHistory)-1].MessageId
				if !strings.HasPrefix(lastMsg, "openai_msg") {
					return false
				}
				return true
			})

			assert.NotNil(t, oaiHistory[1].OfFunctionCall)
			assert.Equal(t, "always_exception", oaiHistory[1].OfFunctionCall.Name)
			assert.Equal(t, "{}", oaiHistory[1].OfFunctionCall.Arguments)

			assert.Nil(t, oaiHistory[2].OfFunctionCall)
			assert.NotNil(t, oaiHistory[2].OfFunctionCallOutput)
			assert.Equal(t, oaiHistory[2].OfFunctionCallOutput.Output, "Error: Because [Alex] didn't tighten the faucet, the [pipe] suddenly started leaking, causing the [kitchen] in chaos, [MacBook Pro] to short-circuit")

			assert.NotNil(t, oaiHistory[3].OfOutputMessage)

			prompt = "Who caused the chaos? What is leaking? Which device is short-circuiting? Which room is in chaos?"
			oaiHistory = append(oaiHistory, createOpenaiUserInputMessage(prompt))
			appHistory = append(appHistory, createAppUserInputMessage(prompt))
			if tc.useStream {
				openaiHistory, inappHistory, err = aiClient.ChatCompletionStream(
					context.Background(),
					&tc.streamServer,
					tc.conversationId,
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
				// 验证流式消息的完整性
				assert.NoError(t, tc.streamServer.ValidateMessageStack())
			} else {
				openaiHistory, inappHistory, err = aiClient.ChatCompletion(
					context.Background(),
					models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI),
					oaiHistory,
				)
			}
			assert.NoError(t, err)

			oaiHistory = openaiHistory
			appHistory = append(appHistory, inappHistory...)

			responseText := strings.ToLower(oaiHistory[5].OfOutputMessage.Content[0].OfOutputText.Text)
			fmt.Println(responseText)
			assert.True(t, strings.Contains(responseText, "alex"))
			assert.True(t, strings.Contains(responseText, "pipe"))
			assert.True(t, strings.Contains(responseText, "kitchen"))
			assert.True(t, strings.Contains(responseText, "macbook pro"))

			responseText = strings.ToLower(appHistory[4].Payload.GetAssistant().GetContent())
			fmt.Println(responseText)
			assert.True(t, strings.Contains(responseText, "alex"))
			assert.True(t, strings.Contains(responseText, "pipe"))
			assert.True(t, strings.Contains(responseText, "kitchen"))
			assert.True(t, strings.Contains(responseText, "macbook pro"))
		})
	}
}
