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
	filetools "paperdebugger/internal/services/toolkit/tools/files"
	latextools "paperdebugger/internal/services/toolkit/tools/latex"
	"paperdebugger/internal/services/toolkit/tools/xtramcp"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
	"strings"
	"time"

	openaiv3 "github.com/openai/openai-go/v3"
)

func appendAssistantTextResponseV2(openaiChatHistory *OpenAIChatHistory, inappChatHistory *AppChatHistory, content string, contentId string, modelSlug string) {
	*openaiChatHistory = append(*openaiChatHistory, openaiv3.ChatCompletionMessageParamUnion{
		OfAssistant: &openaiv3.ChatCompletionAssistantMessageParam{
			Role: "assistant",
			Content: openaiv3.ChatCompletionAssistantMessageParamContentUnion{
				OfArrayOfContentParts: []openaiv3.ChatCompletionAssistantMessageParamContentArrayOfContentPartUnion{
					{
						OfText: &openaiv3.ChatCompletionContentPartTextParam{
							Type: "text",
							Text: content,
						},
					},
				},
			},
		},
	})

	*inappChatHistory = append(*inappChatHistory, chatv2.Message{
		MessageId: contentId,
		Payload: &chatv2.MessagePayload{
			MessageType: &chatv2.MessagePayload_Assistant{
				Assistant: &chatv2.MessageTypeAssistant{
					Content:   content,
					ModelSlug: modelSlug,
				},
			},
		},
		Timestamp: time.Now().Unix(),
	})
}

func getDefaultParamsV2(modelSlug string, toolRegistry *registry.ToolRegistryV2) openaiv3.ChatCompletionNewParams {
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
	for _, model := range reasoningModels {
		if strings.Contains(modelSlug, model) {
			return openaiv3.ChatCompletionNewParams{
				Model:               modelSlug,
				MaxCompletionTokens: openaiv3.Int(4000),
				Tools:               toolRegistry.GetTools(),
				ParallelToolCalls:   openaiv3.Bool(true),
				Store:               openaiv3.Bool(false),
			}
		}
	}

	return openaiv3.ChatCompletionNewParams{
		Model:               modelSlug,
		Temperature:         openaiv3.Float(0.7),
		MaxCompletionTokens: openaiv3.Int(4000),      // DEBUG POINT: change this to test the frontend handler
		Tools:               toolRegistry.GetTools(), // Tool registration is managed centrally by the registry
		ParallelToolCalls:   openaiv3.Bool(true),
		Store:               openaiv3.Bool(false), // Must set to false, because we are construct our own chat history.
	}
}

func CheckOpenAIWorksV2(oaiClient openaiv3.Client, logger *logger.Logger) {
	logger.Info("[AI Client V2] checking if openai client works")
	chatCompletion, err := oaiClient.Chat.Completions.New(context.TODO(), openaiv3.ChatCompletionNewParams{
		Messages: []openaiv3.ChatCompletionMessageParamUnion{
			openaiv3.UserMessage("Say 'openai client works'"),
		},
		Model: "openai/gpt-5-nano",
	})
	if err != nil {
		logger.Errorf("[AI Client V2] openai client does not work: %v", err)
		return
	}
	logger.Info("[AI Client V2] openai client works", "response", chatCompletion.Choices[0].Message.Content)
}

func initializeToolkitV2(
	db *db.DB,
	projectService *services.ProjectService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) *registry.ToolRegistryV2 {
	toolRegistry := registry.NewToolRegistryV2()

	// File tools with ProjectService dependency
	createFileTool := filetools.NewCreateFileTool(projectService)
	readFileTool := filetools.NewReadFileTool(projectService)
	listFolderTool := filetools.NewListFolderTool(projectService)
	searchStringTool := filetools.NewSearchStringTool(projectService)
	searchFileTool := filetools.NewSearchFileTool(projectService)

	// LaTeX tools with ProjectService dependency
	documentStructureTool := latextools.NewDocumentStructureTool(projectService)
	readSectionSourceTool := latextools.NewReadSectionSourceTool(projectService)
	readSourceLineRangeTool := latextools.NewReadSourceLineRangeTool(projectService)

	// Register file tools
	toolRegistry.Register("create_file", filetools.CreateFileToolDescriptionV2, createFileTool.Call)
	toolRegistry.Register("delete_file", filetools.DeleteFileToolDescriptionV2, filetools.DeleteFileTool)
	toolRegistry.Register("create_folder", filetools.CreateFolderToolDescriptionV2, filetools.CreateFolderTool)
	toolRegistry.Register("delete_folder", filetools.DeleteFolderToolDescriptionV2, filetools.DeleteFolderTool)
	toolRegistry.Register("read_file", filetools.ReadFileToolDescriptionV2, readFileTool.Call)
	toolRegistry.Register("list_folder", filetools.ListFolderToolDescriptionV2, listFolderTool.Call)
	toolRegistry.Register("search_string", filetools.SearchStringToolDescriptionV2, searchStringTool.Call)
	toolRegistry.Register("search_file", filetools.SearchFileToolDescriptionV2, searchFileTool.Call)

	// Register LaTeX tools
	toolRegistry.Register("get_document_structure", latextools.GetDocumentStructureToolDescriptionV2, documentStructureTool.Call)
	toolRegistry.Register("locate_section", latextools.LocateSectionToolDescriptionV2, latextools.LocateSectionTool)
	toolRegistry.Register("read_section_source", latextools.ReadSectionSourceToolDescriptionV2, readSectionSourceTool.Call)
	toolRegistry.Register("read_source_line_range", latextools.ReadSourceLineRangeToolDescriptionV2, readSourceLineRangeTool.Call)

	// Load tools dynamically from backend
	xtraMCPLoader := xtramcp.NewXtraMCPLoaderV2(db, projectService, cfg.XtraMCPURI)

	// initialize MCP session first and log session ID
	sessionID, err := xtraMCPLoader.InitializeMCP()
	if err != nil {
		logger.Errorf("[XtraMCP Client] Failed to initialize XtraMCP session: %v", err)
	} else {
		logger.Info("[XtraMCP Client] XtraMCP session initialized", "sessionID", sessionID)

		// dynamically load all tools from XtraMCP backend
		err = xtraMCPLoader.LoadToolsFromBackend(toolRegistry)
		if err != nil {
			logger.Errorf("[XtraMCP Client] Failed to load XtraMCP tools: %v", err)
		}
	}

	return toolRegistry
}
