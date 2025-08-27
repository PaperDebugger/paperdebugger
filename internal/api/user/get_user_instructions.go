package user

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) GetUserInstructions(ctx context.Context, req *userv1.GetUserInstructionsRequest) (*userv1.GetUserInstructionsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, shared.ErrInvalidActor("user not authenticated")
	}

	instructions, err := s.userService.GetUserInstructions(ctx, actor.ID)
	if err != nil {
		s.logger.Error("Failed to get user instructions", "error", err, "userID", actor.ID)
		return nil, shared.ErrInternal("failed to get user instructions")
	}

	return &userv1.GetUserInstructionsResponse{
		Instructions: instructions,
	}, nil
}
