package chat

import (
	"context"
	"strings"

	"paperdebugger/internal/libs/contextutil"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2"
)

func (s *ChatServer) ListSupportedModels(
	ctx context.Context,
	req *chatv1.ListSupportedModelsRequest,
) (*chatv1.ListSupportedModelsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := s.userService.GetUserSettings(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	var models []*chatv1.SupportedModel
	if strings.TrimSpace(settings.OpenAIAPIKey) == "" {
		models = []*chatv1.SupportedModel{
			{

				Name: "GPT-4o",
				Slug: openai.ChatModelGPT4o,
			},
			{
				Name: "GPT-4.1",
				Slug: openai.ChatModelGPT4_1_2025_04_14,
			},
			{
				Name: "GPT-4.1-mini",
				Slug: openai.ChatModelGPT4_1Mini,
			},
		}
	} else {
		models = []*chatv1.SupportedModel{
			{
				Name: "GPT 4o",
				Slug: openai.ChatModelGPT4o,
			},
			{
				Name: "GPT 4.1",
				Slug: openai.ChatModelGPT4_1,
			},
			{
				Name: "GPT 4.1 mini",
				Slug: openai.ChatModelGPT4_1Mini,
			},
			{
				Name: "GPT 5",
				Slug: openai.ChatModelGPT5,
			},
			{
				Name: "GPT 5 mini",
				Slug: openai.ChatModelGPT5Mini,
			},
			{
				Name: "GPT 5 nano",
				Slug: openai.ChatModelGPT5Nano,
			},
			{
				Name: "GPT 5 Chat Latest",
				Slug: openai.ChatModelGPT5ChatLatest,
			},
			{
				Name: "o1",
				Slug: openai.ChatModelO1,
			},
			{
				Name: "o1 mini",
				Slug: openai.ChatModelO1Mini,
			},
			{
				Name: "o3",
				Slug: openai.ChatModelO3,
			},
			{
				Name: "o3 mini",
				Slug: openai.ChatModelO3Mini,
			},
			{
				Name: "o4 mini",
				Slug: openai.ChatModelO4Mini,
			},
			{
				Name: "Codex Mini Latest",
				Slug: openai.ChatModelCodexMiniLatest,
			},
		}
	}

	return &chatv1.ListSupportedModelsResponse{
		Models: models,
	}, nil
}
