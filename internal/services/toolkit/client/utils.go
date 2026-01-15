package client

/*
This file contains utility functions for the client package. (Mainly miscellaneous helpers)

It is used to append assistant responses to both OpenAI and in-app chat histories, and to create response items for chat interactions.
*/
import (
	"context"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/registry"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2"
	openaiv2 "github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/responses"
	"github.com/samber/lo"
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
func getDefaultParams(modelSlug string, toolRegistry *registry.ToolRegistry) responses.ResponseNewParams {
	var reasoningModels = []string{
		"gpt-5",
		"gpt-5-mini",
		"gpt-5-nano",
		"gpt-5-chat-latest",
		"o4-mini",
		"o3-mini",
		"o3",
		"o1-mini",
		"o1",
		"codex-mini-latest",
	}
	if lo.Contains(reasoningModels, modelSlug) {
		return responses.ResponseNewParams{
			Model: modelSlug,
			Tools: toolRegistry.GetTools(),
			Store: openaiv2.Bool(false),
		}
	}

	return responses.ResponseNewParams{
		Model:           modelSlug,
		Temperature:     openaiv2.Float(0.7),
		MaxOutputTokens: openaiv2.Int(4000),      // DEBUG POINT: change this to test the frontend handler
		Tools:           toolRegistry.GetTools(), // Tool registration is managed centrally by the registry
		Store:           openaiv2.Bool(false),    // Must set to false, because we are construct our own chat history.
	}
}

func CheckOpenAIWorks(oaiClient openai.Client, logger *logger.Logger) {
	logger.Info("[AI Client] checking if openai client works")
	chatCompletion, err := oaiClient.Chat.Completions.New(context.TODO(), openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("Say 'openai client works'"),
		},
		Model: openai.ChatModelGPT4o,
	})
	if err != nil {
		logger.Errorf("[AI Client] openai client does not work: %v", err)
		return
	}
	logger.Info("[AI Client] openai client works", "response", chatCompletion.Choices[0].Message.Content)
}

// initializeToolkit creates and initializes the tool registry with XtraMCP tools.
// This is shared between AIClient and AIClientV2 to avoid code duplication.
func initializeToolkit(
	db *db.DB,
	projectService *services.ProjectService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) *registry.ToolRegistry {
	toolRegistry := registry.NewToolRegistry()

	// // Load tools dynamically from backend
	// xtraMCPLoader := xtramcp.NewXtraMCPLoader(db, projectService, cfg.XtraMCPURI)

	// // initialize MCP session first and log session ID
	// sessionID, err := xtraMCPLoader.InitializeMCP()
	// if err != nil {
	// 	logger.Errorf("[XtraMCP Client] Failed to initialize XtraMCP session: %v", err)
	// 	// TODO: Fallback to static tools or exit?
	// } else {
	// 	logger.Info("[XtraMCP Client] XtraMCP session initialized", "sessionID", sessionID)

	// 	// dynamically load all tools from XtraMCP backend
	// 	err = xtraMCPLoader.LoadToolsFromBackend(toolRegistry)
	// 	if err != nil {
	// 		logger.Errorf("[XtraMCP Client] Failed to load XtraMCP tools: %v", err)
	// 	} else {
	// 		logger.Info("[XtraMCP Client] Successfully loaded XtraMCP tools")
	// 	}
	// }

	return toolRegistry
}
