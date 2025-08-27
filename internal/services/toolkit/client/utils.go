package client

/*
This file contains utility functions for the client package. (Mainly miscellaneous helpers)

It is used to append assistant responses to both OpenAI and in-app chat histories, and to create response items for chat interactions.
*/
import (
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/registry"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/responses"
)

// appendAssistantTextResponse appends the assistant's response to both OpenAI and in-app chat histories.
// Uses pointer passing internally to avoid unnecessary copying.
func appendAssistantTextResponse(openaiChatHistory *responses.ResponseNewParamsInputUnion, inappChatHistory *[]chatv1.Message, item responses.ResponseOutputItemUnion) {
	text := item.Content[0].Text
	response := responses.ResponseInputItemUnionParam{
		OfOutputMessage: &responses.ResponseOutputMessageParam{
			Content: []responses.ResponseOutputMessageContentUnionParam{
				{
					OfOutputText: &responses.ResponseOutputTextParam{Text: text},
				},
			},
		},
	}
	openaiChatHistory.OfInputItemList = append(openaiChatHistory.OfInputItemList, response)
	*inappChatHistory = append(*inappChatHistory, chatv1.Message{
		MessageId: "openai_" + item.ID,
		Payload: &chatv1.MessagePayload{
			MessageType: &chatv1.MessagePayload_Assistant{
				Assistant: &chatv1.MessageTypeAssistant{
					Content: text,
				},
			},
		},
	})
}

// getDefaultParams constructs the default parameters for a chat completion request.
// The tool registry is managed centrally by the registry package.
// The chat history is constructed manually, so Store must be set to false.
func getDefaultParams(languageModel models.LanguageModel, chatHistory responses.ResponseNewParamsInputUnion, toolRegistry *registry.ToolRegistry) responses.ResponseNewParams {
	if languageModel == models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5) ||
		languageModel == models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_MINI) ||
		languageModel == models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_NANO) {
		return responses.ResponseNewParams{
			Model: languageModel.Name(),
			Tools: toolRegistry.GetTools(),
			Input: chatHistory,
			Store: openai.Bool(false),
		}
	}
	return responses.ResponseNewParams{
		Model:           languageModel.Name(),
		Temperature:     openai.Float(0.7),
		MaxOutputTokens: openai.Int(4000),        // DEBUG POINT: change this to test the frontend handler
		Tools:           toolRegistry.GetTools(), // 工具注册由 registry 统一管理
		Input:           chatHistory,
		Store:           openai.Bool(false), // Must set to false, because we are construct our own chat history.
	}
}
