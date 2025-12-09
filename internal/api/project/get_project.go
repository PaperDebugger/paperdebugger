package project

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	apperrors "paperdebugger/internal/libs/errors"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

func (s *ProjectServer) GetProject(
	ctx context.Context,
	req *projectv1.GetProjectRequest,
) (*projectv1.GetProjectResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if req.GetProjectId() == "" {
		return nil, apperrors.ErrBadRequest("project_id is required")
	}

	project, err := s.projectService.GetProject(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		return nil, err
	}

	return &projectv1.GetProjectResponse{
		Project: mapper.MapModelProjectToProto(project),
	}, nil
}
