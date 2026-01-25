package client

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/handler"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
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
// V2 uses the inference endpoint by default.
// When a user provides their own API key, use the /openai endpoint instead of /openrouter.
func (a *AIClientV2) GetOpenAIClient(llmConfig *models.LLMProviderConfig) *openai.Client {
	var Endpoint string = llmConfig.Endpoint
	var APIKey string = llmConfig.APIKey

	if Endpoint == "" {
		if APIKey != "" {
			// User provided their own API key, use the OpenAI-compatible endpoint
			Endpoint = a.cfg.InferenceBaseURL + "/openai"
		} else {
			Endpoint = a.cfg.InferenceBaseURL + "/openrouter"
		}
	}

	if APIKey == "" {
		APIKey = a.cfg.InferenceAPIKey
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

	llmProvider := &models.LLMProviderConfig{
		APIKey: cfg.OpenAIAPIKey,
	}

	var baseUrl string
	var apiKey string
	var modelSlug string

	if llmProvider != nil && llmProvider.IsCustom() {
		baseUrl = cfg.OpenAIBaseURL
		apiKey = cfg.OpenAIAPIKey
		modelSlug = "gpt-5-nano"
	} else {
		baseUrl = cfg.InferenceBaseURL + "/openrouter"
		apiKey = cfg.InferenceAPIKey
		modelSlug = "openai/gpt-5-nano"
	}

	oaiClient := openai.NewClient(
		option.WithBaseURL(baseUrl),
		option.WithAPIKey(apiKey),
	)
	CheckOpenAIWorksV2(oaiClient, baseUrl, modelSlug, logger)

	toolRegistry := initializeToolkitV2(db, projectService, cfg, logger)
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
