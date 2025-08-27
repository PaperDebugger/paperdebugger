package project

import (
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

type ProjectServer struct {
	projectv1.UnimplementedProjectServiceServer
	projectService *services.ProjectService
	logger         *logger.Logger
	cfg            *cfg.Cfg
}

func NewProjectServer(
	projectService *services.ProjectService,
	logger *logger.Logger,
	cfg *cfg.Cfg,
) projectv1.ProjectServiceServer {
	return &ProjectServer{
		projectService: projectService,
		logger:         logger,
		cfg:            cfg,
	}
}
