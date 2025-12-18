package chat

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	aiclient "paperdebugger/internal/services/toolkit/client"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
)

type ChatServer struct {
	aiClient       *aiclient.AIClient
	chatService    *services.ChatService
	projectService *services.ProjectService
	userService    *services.UserService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

type ChatServerV1 struct {
	chatv1.UnimplementedChatServiceServer
	*ChatServer
}

type ChatServerV2 struct {
	chatv2.UnimplementedChatServiceServer
	*ChatServer
}

func NewChatServer(
	aiClient *aiclient.AIClient,
	chatService *services.ChatService,
	projectService *services.ProjectService,
	userService *services.UserService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) chatv1.ChatServiceServer {
	return &ChatServerV1{
		ChatServer: &ChatServer{
			aiClient:       aiClient,
			chatService:    chatService,
			projectService: projectService,
			userService:    userService,
			logger:         logger,
			cfg:            cfg,
		},
	}
}

func NewChatServerV2(v1Server chatv1.ChatServiceServer) chatv2.ChatServiceServer {
	if s, ok := v1Server.(*ChatServerV1); ok {
		return &ChatServerV2{
			ChatServer: s.ChatServer,
		}
	}
	return nil
}
