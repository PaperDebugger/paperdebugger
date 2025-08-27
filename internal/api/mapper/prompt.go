package mapper

import (
	"google.golang.org/protobuf/types/known/timestamppb"
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func MapModelPromptToProto(p *models.Prompt) *userv1.Prompt {
	if p == nil {
		return nil
	}

	return &userv1.Prompt{
		Id:           p.ID.Hex(),
		CreatedAt:    timestamppb.New(p.CreatedAt.Time()),
		UpdatedAt:    timestamppb.New(p.UpdatedAt.Time()),
		Title:        p.Title,
		Content:      p.Content,
		IsUserPrompt: true,
	}
}

func MapModelPromptsToProto(prompts []*models.Prompt) []*userv1.Prompt {
	result := make([]*userv1.Prompt, len(prompts))
	for i, p := range prompts {
		result[i] = MapModelPromptToProto(p)
	}
	return result
}
