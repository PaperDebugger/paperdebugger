package v2

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	projectv2 "paperdebugger/pkg/gen/api/project/v2"
)

type ProjectServerV2 struct {
	projectv2.UnimplementedProjectServiceServer
	projectService *services.ProjectService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

func NewProjectServerV2(
	projectService *services.ProjectService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) projectv2.ProjectServiceServer {
	return &ProjectServerV2{
		projectService: projectService,
		logger:         logger,
		cfg:            cfg,
	}
}
