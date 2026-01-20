package v2

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	projectv2 "paperdebugger/pkg/gen/api/project/v2"
)

func (s *ProjectServerV2) UpsertProject(
	ctx context.Context,
	req *projectv2.UpsertProjectRequest,
) (*projectv2.UpsertProjectResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}
	if req.GetName() == "" {
		return nil, shared.ErrBadRequest("name is required")
	}

	project := &models.ProjectV2{
		ProjectID:    req.GetProjectId(),
		Name:         req.GetName(),
		RootDocID:    req.GetRootDocId(),
		RootFolder:   mapper.MapProtoProjectFolderToModel(req.GetRootFolder()),
		Instructions: req.GetInstructions(),
	}

	project, err = s.projectService.UpsertProjectV2(ctx, actor.ID, req.GetProjectId(), project)
	if err != nil {
		return nil, err
	}

	return &projectv2.UpsertProjectResponse{
		Project: mapper.MapModelProjectToProtoV2(project),
	}, nil
}
