package user

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) UpdatePrompt(
	ctx context.Context,
	req *userv1.UpdatePromptRequest,
) (*userv1.UpdatePromptResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if req.GetPromptId() == "" {
		return nil, shared.ErrBadRequest("prompt_id cannot be empty")
	}
	if req.GetTitle() == "" {
		return nil, shared.ErrBadRequest("title cannot be empty")
	}
	if req.GetContent() == "" {
		return nil, shared.ErrBadRequest("content cannot be empty")
	}

	prompt := &models.Prompt{
		Title:   req.GetTitle(),
		Content: req.GetContent(),
	}

	updatedPrompt, err := s.promptService.UpdatePrompt(ctx, actor.ID, req.GetPromptId(), prompt)
	if err != nil {
		return nil, err
	}

	return &userv1.UpdatePromptResponse{
		Prompt: mapper.MapModelPromptToProto(updatedPrompt),
	}, nil
}
