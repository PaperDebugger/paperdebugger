//go:build wireinject
// +build wireinject

package internal

import (
	"paperdebugger/internal/api"
	"paperdebugger/internal/api/auth"
	"paperdebugger/internal/api/chat"
	"paperdebugger/internal/api/comment"
	"paperdebugger/internal/api/project"
	projectv2 "paperdebugger/internal/api/project/v2"
	"paperdebugger/internal/api/user"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	aiclient "paperdebugger/internal/services/toolkit/client"

	"github.com/google/wire"
)

var Set = wire.NewSet(
	api.NewServer,

	api.NewGrpcServer,
	api.NewGinServer,

	auth.NewOAuthHandler,
	auth.NewAuthServer,
	chat.NewChatServer,
	chat.NewChatServerV2,
	user.NewUserServer,
	project.NewProjectServer,
	projectv2.NewProjectServerV2,
	comment.NewCommentServer,

	aiclient.NewAIClient,
	aiclient.NewAIClientV2,
	services.NewReverseCommentService,
	services.NewChatService,
	services.NewChatServiceV2,
	services.NewTokenService,
	services.NewUserService,
	services.NewProjectService,
	services.NewPromptService,
	services.NewOAuthService,

	cfg.GetCfg,
	logger.GetLogger,
	db.NewDB,
)

func InitializeApp() (*api.Server, error) {
	wire.Build(Set)
	return nil, nil
}
