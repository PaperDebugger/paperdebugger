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
	"paperdebugger/internal/services/toolkit/tools/xtragpt"

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
	CheckOpenAIWorks(oaiClient, logger)
	toolSearchPapers := xtragpt.NewSearchPapersTool(db, projectService)
	// toolPaperScore := tools.NewPaperScoreTool(db, projectService)
	// toolPaperScoreComment := tools.NewPaperScoreCommentTool(db, projectService, reverseCommentService)

	toolRegistry := registry.NewToolRegistry()

	// toolRegistry.Register("always_exception", tools.AlwaysExceptionToolDescription, tools.AlwaysExceptionTool)
	// toolRegistry.Register("greeting", tools.GreetingToolDescription, tools.GreetingTool)
	// toolRegistry.Register("paper_score", toolPaperScore.Description, toolPaperScore.Call)
	// toolRegistry.Register("paper_score_comment", toolPaperScoreComment.Description, toolPaperScoreComment.Call)

	// toolRegistry.Register("export_papers")
	// toolRegistry.Register("get_conference_papers")
	// toolRegistry.Register("get_user_papers")
	toolRegistry.Register("search_papers", toolSearchPapers.Description, toolSearchPapers.Call)
	// toolRegistry.Register("search_user")
	// toolRegistry.Register("identify_improvements")
	// toolRegistry.Register("suggest_improvement")

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

func CheckOpenAIWorks(oaiClient openai.Client, logger *logger.Logger) {
	logger.Info("[AI Client] checking if openai client works")
	chatCompletion, err := oaiClient.Chat.Completions.New(context.TODO(), openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("Say 'openai client works'"),
		},
		Model: openai.ChatModelGPT4o,
	})
	if err != nil {
		logger.Fatalf("[AI Client] openai client does not work: %v", err)
	}
	logger.Info("[AI Client] openai client works", "response", chatCompletion.Choices[0].Message.Content)
}
