package client

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/handler"
	"paperdebugger/internal/services/toolkit/registry"
	"paperdebugger/internal/services/toolkit/tools"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/option"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type AIClient struct {
	openaiClient    *openai.Client
	toolCallHandler *handler.ToolCallHandler

	db                     *mongo.Database
	functionCallCollection *mongo.Collection

	reverseCommentService *services.ReverseCommentService
	projectService        *services.ProjectService
	cfg                   *cfg.Cfg
	logger                *logger.Logger
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
		option.WithAPIKey(cfg.OpenAIAPIKey),
	)

	toolPaperScore := tools.NewPaperScoreTool(db, projectService)
	toolPaperScoreComment := tools.NewPaperScoreCommentTool(db, projectService, reverseCommentService)

	toolRegistry := registry.NewToolRegistry()
	toolRegistry.Register("always_exception", tools.AlwaysExceptionToolDescription, tools.AlwaysExceptionTool)
	toolRegistry.Register("greeting", tools.GreetingToolDescription, tools.GreetingTool)
	toolRegistry.Register("paper_score", toolPaperScore.Description, toolPaperScore.Call)
	toolRegistry.Register("paper_score_comment", toolPaperScoreComment.Description, toolPaperScoreComment.Call)

	toolCallHandler := handler.NewToolCallHandler(toolRegistry)

	client := &AIClient{
		openaiClient:    &oaiClient,
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
