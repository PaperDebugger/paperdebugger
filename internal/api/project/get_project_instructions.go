package project

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	apperrors "paperdebugger/internal/libs/errors"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

func (s *ProjectServer) GetProjectInstructions(ctx context.Context, req *projectv1.GetProjectInstructionsRequest) (*projectv1.GetProjectInstructionsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, apperrors.ErrInvalidActor("user not authenticated")
	}

	if req.GetProjectId() == "" {
		return nil, apperrors.ErrBadRequest("project_id is required")
	}

	instructions, err := s.projectService.GetProjectInstructions(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		s.logger.Error("Failed to get project instructions", "error", err, "userID", actor.ID, "projectID", req.GetProjectId())
		return nil, apperrors.ErrInternal("failed to get project instructions")
	}

	return &projectv1.GetProjectInstructionsResponse{
		ProjectId:    req.GetProjectId(),
		Instructions: instructions,
	}, nil
}
