package chat

import (
	"context"
	"strings"

	"paperdebugger/internal/libs/contextutil"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v3"
)

func (s *ChatServerV2) ListSupportedModels(
	ctx context.Context,
	req *chatv2.ListSupportedModelsRequest,
) (*chatv2.ListSupportedModelsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := s.userService.GetUserSettings(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	var models []*chatv2.SupportedModel
	if strings.TrimSpace(settings.OpenAIAPIKey) == "" {
		models = []*chatv2.SupportedModel{
			{

				Name: "GPT-4o",
				Slug: "openai/gpt-4o",
			},
			{
				Name: "GPT-4.1",
				Slug: "openai/gpt-4.1",
			},
			{
				Name: "GPT-4.1-mini",
				Slug: "openai/gpt-4.1-mini",
			},
			{
				Name: "Qwen Plus (balanced)",
				Slug: "qwen/qwen-plus",
			},
			{
				Name: "Qwen Turbo (fast)",
				Slug: "qwen/qwen-turbo",
			},
			{
				Name: "Gemini 2.5 Flash (fast)",
				Slug: "google/gemini-2.5-flash",
			},
		}
	} else {
		models = []*chatv2.SupportedModel{
			{

				Name: "GPT-4o",
				Slug: openai.ChatModelGPT4o,
			},
			{
				Name: "GPT-4.1",
				Slug: openai.ChatModelGPT4_1,
			},
			{
				Name: "GPT-4.1-mini",
				Slug: openai.ChatModelGPT4_1Mini,
			},
			// TODO: add user custom models
		}
	}

	return &chatv2.ListSupportedModelsResponse{
		Models: models,
	}, nil
}
