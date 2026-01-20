package v2

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	projectv2 "paperdebugger/pkg/gen/api/project/v2"
)

func (s *ProjectServerV2) GetProject(
	ctx context.Context,
	req *projectv2.GetProjectRequest,
) (*projectv2.GetProjectResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}

	project, err := s.projectService.GetProjectV2(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		return nil, err
	}

	return &projectv2.GetProjectResponse{
		Project: mapper.MapModelProjectToProtoV2(project),
	}, nil
}
