package auth

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"
)

type AuthServer struct {
	authv1.UnimplementedAuthServiceServer

	tokenService *services.TokenService
	userService  *services.UserService
	cfg          *cfg.Cfg
	logger       *logger.Logger
}

func NewAuthServer(
	tokenService *services.TokenService,
	userService *services.UserService,
	cfg *cfg.Cfg,
	logger *logger.Logger,
) authv1.AuthServiceServer {
	return &AuthServer{
		tokenService: tokenService,
		userService:  userService,
		cfg:          cfg,
		logger:       logger,
	}
}
