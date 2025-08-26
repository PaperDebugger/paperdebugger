package user

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) CreatePrompt(
	ctx context.Context,
	req *userv1.CreatePromptRequest,
) (*userv1.CreatePromptResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
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

	createdPrompt, err := s.promptService.CreatePrompt(ctx, actor.ID, prompt)
	if err != nil {
		return nil, err
	}

	return &userv1.CreatePromptResponse{
		Prompt: mapper.MapModelPromptToProto(createdPrompt),
	}, nil
}
