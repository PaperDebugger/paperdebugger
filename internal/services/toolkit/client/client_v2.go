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
			Endpoint = a.cfg.OpenAIBaseURL // standard openai base url
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

	if cfg.InferenceBaseURL != "" && cfg.InferenceAPIKey != "" {
		oaiClient := openai.NewClient(
			option.WithBaseURL(cfg.InferenceBaseURL+"/openrouter"),
			option.WithAPIKey(cfg.InferenceAPIKey),
		)
		CheckOpenAIWorksV2(oaiClient, cfg.InferenceBaseURL+"/openrouter", "openai/gpt-5-nano", logger)
	} else {
		oaiClient := openai.NewClient(
			option.WithBaseURL(cfg.OpenAIBaseURL),
			option.WithAPIKey(cfg.OpenAIAPIKey),
		)
		CheckOpenAIWorksV2(oaiClient, cfg.OpenAIBaseURL, "gpt-5-nano", logger)
	}

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
