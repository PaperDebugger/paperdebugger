package user

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
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
		return nil, shared.ErrBadRequest("prompt_id cannot be empty")
	}

	err = s.promptService.DeletePrompt(ctx, actor.ID, req.GetPromptId())
	if err != nil {
		return nil, err
	}

	return &userv1.DeletePromptResponse{}, nil
}
