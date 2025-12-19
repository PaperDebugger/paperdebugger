package chat

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	aiclient "paperdebugger/internal/services/toolkit/client"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
)

type ChatServerV2 struct {
	chatv2.UnimplementedChatServiceServer
	aiClientV2     *aiclient.AIClientV2
	chatServiceV2  *services.ChatServiceV2
	projectService *services.ProjectService
	userService    *services.UserService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

func NewChatServerV2(
	aiClientV2 *aiclient.AIClientV2,
	chatServiceV2 *services.ChatServiceV2,
	projectService *services.ProjectService,
	userService *services.UserService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) chatv2.ChatServiceServer {
	return &ChatServerV2{
		aiClientV2:     aiClientV2,
		projectService: projectService,
		userService:    userService,
		logger:         logger,
		chatServiceV2:  chatServiceV2,
		cfg:            cfg,
	}
}
