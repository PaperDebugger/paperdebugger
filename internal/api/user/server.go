package user

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

type UserServer struct {
	userv1.UnimplementedUserServiceServer

	userService   *services.UserService
	promptService *services.PromptService
	cfg           *cfg.Cfg
	logger        *logger.Logger
}

func NewUserServer(
	userService *services.UserService,
	promptService *services.PromptService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) userv1.UserServiceServer {
	return &UserServer{
		userService:   userService,
		promptService: promptService,
		cfg:           cfg,
		logger:        logger,
	}
}
