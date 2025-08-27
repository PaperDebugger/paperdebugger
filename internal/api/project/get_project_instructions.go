package project

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

func (s *ProjectServer) GetProjectInstructions(ctx context.Context, req *projectv1.GetProjectInstructionsRequest) (*projectv1.GetProjectInstructionsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, shared.ErrInvalidActor("user not authenticated")
	}

	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}

	instructions, err := s.projectService.GetProjectInstructions(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		s.logger.Error("Failed to get project instructions", "error", err, "userID", actor.ID, "projectID", req.GetProjectId())
		return nil, shared.ErrInternal("failed to get project instructions")
	}

	return &projectv1.GetProjectInstructionsResponse{
		ProjectId:    req.GetProjectId(),
		Instructions: instructions,
	}, nil
}
