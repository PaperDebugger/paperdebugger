package comment

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	commentv1 "paperdebugger/pkg/gen/api/comment/v1"
)

// CommentServer implements commentv1.CommentServiceServer
type CommentServer struct {
	commentv1.UnimplementedCommentServiceServer
	projectService        *services.ProjectService
	conversationService   *services.ChatService
	reverseCommentService *services.ReverseCommentService
	logger                *logger.Logger
	cfg                   *cfg.Cfg
}

func NewCommentServer(
	projectService *services.ProjectService,
	conversationService *services.ChatService,
	reverseCommentService *services.ReverseCommentService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) commentv1.CommentServiceServer {
	return &CommentServer{
		projectService:        projectService,
		conversationService:   conversationService,
		reverseCommentService: reverseCommentService,
		logger:                logger,
		cfg:                   cfg,
	}
}
