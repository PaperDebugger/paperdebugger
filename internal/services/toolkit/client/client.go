package client

import (
	"context"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/handler"
	"paperdebugger/internal/services/toolkit/registry"
	"paperdebugger/internal/services/toolkit/tools"
	"paperdebugger/internal/services/toolkit/tools/xtramcp"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type AIClient struct {
	toolCallHandler *handler.ToolCallHandler

	db                     *mongo.Database
	functionCallCollection *mongo.Collection

	reverseCommentService *services.ReverseCommentService
	projectService        *services.ProjectService
	cfg                   *cfg.Cfg
	logger                *logger.Logger
}

// SetOpenAIClient sets the appropriate OpenAI client based on the LLM provider config.
// If the config specifies a custom endpoint and API key, a new client is created for that endpoint.
func (a *AIClient) GetOpenAIClient(llmConfig *models.LLMProviderConfig) *openai.Client {
	var Endpoint string = llmConfig.Endpoint
	var APIKey string = llmConfig.APIKey

	if Endpoint == "" {
		Endpoint = a.cfg.OpenAIBaseURL
	}

	if APIKey == "" {
		APIKey = a.cfg.OpenAIAPIKey
	}

	opts := []option.RequestOption{
		option.WithAPIKey(APIKey),
		option.WithBaseURL(Endpoint),
	}

	client := openai.NewClient(opts...)
	return &client
}

func NewAIClient(
	db *db.DB,

	reverseCommentService *services.ReverseCommentService,
	projectService *services.ProjectService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) *AIClient {
	database := db.Database("paperdebugger")
	oaiClient := openai.NewClient(
		option.WithBaseURL(cfg.OpenAIBaseURL),
		option.WithAPIKey(cfg.OpenAIAPIKey),
	)
	CheckOpenAIWorks(oaiClient, logger)
	// toolPaperScore := tools.NewPaperScoreTool(db, projectService)
	// toolPaperScoreComment := tools.NewPaperScoreCommentTool(db, projectService, reverseCommentService)

	toolRegistry := registry.NewToolRegistry()

	toolRegistry.Register("always_exception", tools.AlwaysExceptionToolDescription, tools.AlwaysExceptionTool)
	toolRegistry.Register("greeting", tools.GreetingToolDescription, tools.GreetingTool)
	toolRegistry.Register("get_weather", tools.GetWeatherToolDescription, tools.GetWeatherTool)
	toolRegistry.Register("get_rain_probability", tools.GetRainProbabilityToolDescription, tools.GetRainProbabilityTool)

	// Load tools dynamically from backend
	xtraMCPLoader := xtramcp.NewXtraMCPLoader(db, projectService, cfg.XtraMCPURI)

	// initialize MCP session first and log session ID
	sessionID, err := xtraMCPLoader.InitializeMCP()
	if err != nil {
		logger.Errorf("[AI Client] Failed to initialize XtraMCP session: %v", err)
		// TODO: Fallback to static tools or exit?
	} else {
		logger.Info("[AI Client] XtraMCP session initialized", "sessionID", sessionID)

		// dynamically load all tools from XtraMCP backend
		err = xtraMCPLoader.LoadToolsFromBackend(toolRegistry)
		if err != nil {
			logger.Errorf("[AI Client] Failed to load XtraMCP tools: %v", err)
		} else {
			logger.Info("[AI Client] Successfully loaded XtraMCP tools")
		}
	}

	toolCallHandler := handler.NewToolCallHandler(toolRegistry)
	client := &AIClient{
		toolCallHandler: toolCallHandler,

		db:                     database,
		functionCallCollection: database.Collection((models.FunctionCall{}).CollectionName()),

		reverseCommentService: reverseCommentService,
		projectService:        projectService,
		cfg:                   cfg,
		logger:                logger,
	}

	return client
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
