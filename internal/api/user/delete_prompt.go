package user

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	apperrors "paperdebugger/internal/libs/errors"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) DeletePrompt(
	ctx context.Context,
	req *userv1.DeletePromptRequest,
) (*userv1.DeletePromptResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if req.GetPromptId() == "" {
		return nil, apperrors.ErrBadRequest("prompt_id cannot be empty")
	}

	err = s.promptService.DeletePrompt(ctx, actor.ID, req.GetPromptId())
	if err != nil {
		return nil, err
	}

	return &userv1.DeletePromptResponse{}, nil
}
