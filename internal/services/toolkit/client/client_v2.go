package client

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/handler"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/option"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type AIClientV2 struct {
	toolCallHandler        *handler.ToolCallHandlerV2
	db                     *mongo.Database
	functionCallCollection *mongo.Collection

	reverseCommentService *services.ReverseCommentService
	projectService        *services.ProjectService
	cfg                   *cfg.Cfg
	logger                *logger.Logger
}

// SetOpenAIClient sets the appropriate OpenAI client based on the LLM provider config.
// If the config specifies a custom endpoint and API key, a new client is created for that endpoint.
func (a *AIClientV2) GetOpenAIClient(llmConfig *models.LLMProviderConfig) *openai.Client {
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

func NewAIClientV2(
	db *db.DB,

	reverseCommentService *services.ReverseCommentService,
	projectService *services.ProjectService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) *AIClientV2 {
	database := db.Database("paperdebugger")
	oaiClient := openai.NewClient(
		option.WithBaseURL(cfg.OpenAIBaseURL),
		option.WithAPIKey(cfg.OpenAIAPIKey),
	)
	CheckOpenAIWorks(oaiClient, logger)

	toolRegistry := initializeToolkit(db, projectService, cfg, logger)
	toolCallHandler := handler.NewToolCallHandlerV2(toolRegistry)

	client := &AIClientV2{
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
