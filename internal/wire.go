//go:build wireinject
// +build wireinject

package internal

import (
	"paperdebugger/internal/api"
	"paperdebugger/internal/api/auth"
	"paperdebugger/internal/api/chat"
	"paperdebugger/internal/api/comment"
	complianceapi "paperdebugger/internal/api/compliance"
	"paperdebugger/internal/api/project"
	"paperdebugger/internal/api/user"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	compliancesvc "paperdebugger/internal/services/compliance"
	"paperdebugger/internal/services/compliance/rules"
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
	comment.NewCommentServer,
	complianceapi.NewComplianceServer,

	aiclient.NewAIClient,
	aiclient.NewAIClientV2,
	wire.Bind(new(rules.AIRunner), new(*aiclient.AIClientV2)),
	services.NewReverseCommentService,
	services.NewChatService,
	services.NewChatServiceV2,
	services.NewTokenService,
	services.NewUserService,
	services.NewProjectService,
	services.NewPromptService,
	services.NewOAuthService,
	compliancesvc.NewComplianceService,

	cfg.GetCfg,
	logger.GetLogger,
	db.NewDB,
)

func InitializeApp() (*api.Server, error) {
	wire.Build(Set)
	return nil, nil
}
