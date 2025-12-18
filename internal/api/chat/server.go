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
	aiClientV1     *aiclient.AIClient
	aiClientV2     *aiclient.AIClientV2
	chatServiceV1  *services.ChatService
	chatServiceV2  *services.ChatServiceV2
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
	aiClientV1 *aiclient.AIClient,
	aiClientV2 *aiclient.AIClientV2,
	chatService *services.ChatService,
	chatServiceV2 *services.ChatServiceV2,
	projectService *services.ProjectService,
	userService *services.UserService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) chatv1.ChatServiceServer {
	return &ChatServerV1{
		ChatServer: &ChatServer{
			aiClientV1:     aiClientV1,
			aiClientV2:     aiClientV2,
			projectService: projectService,
			userService:    userService,
			logger:         logger,
			chatServiceV1:  chatService,
			chatServiceV2:  chatServiceV2,
			cfg:            cfg,
		},
	}
}

func NewChatServerV2(v1Server chatv1.ChatServiceServer, chatService *services.ChatServiceV2) chatv2.ChatServiceServer {
	if s, ok := v1Server.(*ChatServerV1); ok {
		return &ChatServerV2{
			ChatServer: s.ChatServer,
		}
	}
	return nil
}
