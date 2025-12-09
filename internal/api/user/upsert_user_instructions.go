package user

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	apperrors "paperdebugger/internal/libs/errors"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) UpsertUserInstructions(ctx context.Context, req *userv1.UpsertUserInstructionsRequest) (*userv1.UpsertUserInstructionsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, apperrors.ErrInvalidActor("user not authenticated")
	}

	instructions, err := s.userService.UpsertUserInstructions(ctx, actor.ID, req.GetInstructions())
	if err != nil {
		s.logger.Error("Failed to upsert user instructions", "error", err, "userID", actor.ID)
		return nil, apperrors.ErrInternal("failed to upsert user instructions")
	}

	return &userv1.UpsertUserInstructionsResponse{
		Instructions: instructions,
	}, nil
}
