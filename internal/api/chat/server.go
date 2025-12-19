package chat

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	aiclient "paperdebugger/internal/services/toolkit/client"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

type ChatServerV1 struct {
	chatv1.UnimplementedChatServiceServer
	aiClientV1     *aiclient.AIClient
	chatServiceV1  *services.ChatService
	projectService *services.ProjectService
	userService    *services.UserService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

func NewChatServer(
	aiClientV1 *aiclient.AIClient,
	chatService *services.ChatService,
	projectService *services.ProjectService,
	userService *services.UserService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) chatv1.ChatServiceServer {
	return &ChatServerV1{
		aiClientV1:     aiClientV1,
		projectService: projectService,
		userService:    userService,
		logger:         logger,
		chatServiceV1:  chatService,
		cfg:            cfg,
	}
}
