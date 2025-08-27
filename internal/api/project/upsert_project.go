package project

import (
	"context"

	"github.com/samber/lo"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

func (s *ProjectServer) UpsertProject(
	ctx context.Context,
	req *projectv1.UpsertProjectRequest,
) (*projectv1.UpsertProjectResponse, error) {
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

	project := &models.Project{
		ProjectID: req.GetProjectId(),
		Name:      req.GetName(),
		RootDocID: req.GetRootDocId(),
		Docs: lo.Map(req.GetDocs(), func(doc *projectv1.ProjectDoc, _ int) models.ProjectDoc {
			return mapper.MapProtoProjectDocToModel(doc)
		}),
	}

	project, err = s.projectService.UpsertProject(ctx, actor.ID, req.GetProjectId(), project)
	if err != nil {
		return nil, err
	}

	return &projectv1.UpsertProjectResponse{
		Project: mapper.MapModelProjectToProto(project),
	}, nil
}
