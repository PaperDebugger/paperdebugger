package client

/*
This file contains utility functions for the client package. (Mainly miscellaneous helpers)

It is used to append assistant responses to both OpenAI and in-app chat histories, and to create response items for chat interactions.
*/
import (
	"fmt"
	"paperdebugger/internal/services/toolkit/registry"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v3"
)

// appendAssistantTextResponse appends the assistant's response to both OpenAI and in-app chat histories.
// Uses pointer passing internally to avoid unnecessary copying.
func appendAssistantTextResponse(openaiChatHistory *OpenAIChatHistory, inappChatHistory *AppChatHistory, content string, contentId string) {
	*openaiChatHistory = append(*openaiChatHistory, openai.ChatCompletionMessageParamUnion{
		OfAssistant: &openai.ChatCompletionAssistantMessageParam{
			Role: "assistant",
			Content: openai.ChatCompletionAssistantMessageParamContentUnion{
				OfArrayOfContentParts: []openai.ChatCompletionAssistantMessageParamContentArrayOfContentPartUnion{
					{
						OfText: &openai.ChatCompletionContentPartTextParam{
							Type: "text",
							Text: content,
						},
					},
				},
			},
		},
	})

	*inappChatHistory = append(*inappChatHistory, chatv1.Message{
		MessageId: fmt.Sprintf("openai_%s", contentId),
		Payload: &chatv1.MessagePayload{
			MessageType: &chatv1.MessagePayload_Assistant{
				Assistant: &chatv1.MessageTypeAssistant{
					Content: content,
				},
			},
		},
	})
}

// getDefaultParams constructs the default parameters for a chat completion request.
// The tool registry is managed centrally by the registry package.
// The chat history is constructed manually, so Store must be set to false.
func getDefaultParams(modelSlug string, toolRegistry *registry.ToolRegistry) openai.ChatCompletionNewParams {
	// Models that require simplified parameters (newer reasoning models)
	advancedModels := map[string]bool{
		openai.ChatModelGPT5:            true,
		openai.ChatModelGPT5Mini:        true,
		openai.ChatModelGPT5Nano:        true,
		openai.ChatModelGPT5ChatLatest:  true,
		openai.ChatModelO4Mini:          true,
		openai.ChatModelO3Mini:          true,
		openai.ChatModelO3:              true,
		openai.ChatModelO1Mini:          true,
		openai.ChatModelO1:              true,
		openai.ChatModelCodexMiniLatest: true,
	}

	if advancedModels[modelSlug] {
		return openai.ChatCompletionNewParams{
			Model: modelSlug,
			Tools: toolRegistry.GetTools(),
			Store: openai.Bool(false),
		}
	}

	return openai.ChatCompletionNewParams{
		Model:               modelSlug,
		Temperature:         openai.Float(0.7),
		MaxCompletionTokens: openai.Int(4000),        // DEBUG POINT: change this to test the frontend handler
		Tools:               toolRegistry.GetTools(), // 工具注册由 registry 统一管理
		ParallelToolCalls:   openai.Bool(true),
		Store:               openai.Bool(false), // Must set to false, because we are construct our own chat history.
	}
}
