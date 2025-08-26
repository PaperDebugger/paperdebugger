package project

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

func (s *ProjectServer) UpsertProjectInstructions(ctx context.Context, req *projectv1.UpsertProjectInstructionsRequest) (*projectv1.UpsertProjectInstructionsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, shared.ErrInvalidActor("user not authenticated")
	}

	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}

	instructions, err := s.projectService.UpsertProjectInstructions(ctx, actor.ID, req.GetProjectId(), req.GetInstructions())
	if err != nil {
		s.logger.Error("Failed to upsert project instructions", "error", err, "userID", actor.ID, "projectID", req.GetProjectId())
		return nil, shared.ErrInternal("failed to upsert project instructions")
	}

	return &projectv1.UpsertProjectInstructionsResponse{
		ProjectId:    req.GetProjectId(),
		Instructions: instructions,
	}, nil
}
