package chat

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	aiclient "paperdebugger/internal/services/toolkit/client"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

type ChatServer struct {
	chatv1.UnimplementedChatServiceServer

	aiClient       *aiclient.AIClient
	chatService    *services.ChatService
	projectService *services.ProjectService
	userService    *services.UserService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

func NewChatServer(
	aiClient *aiclient.AIClient,
	chatService *services.ChatService,
	projectService *services.ProjectService,
	userService *services.UserService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) chatv1.ChatServiceServer {
	return &ChatServer{
		aiClient:       aiClient,
		chatService:    chatService,
		projectService: projectService,
		userService:    userService,
		logger:         logger,
		cfg:            cfg,
	}
}
