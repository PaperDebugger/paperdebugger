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
				Name:         "GPT-4.1",
				Slug:         "openai/gpt-4.1",
				TotalContext: 1050000,
				MaxOutput:    32800,
				InputPrice:   200,
				OutputPrice:  800,
			},
			{
				Name:         "GPT-4o",
				Slug:         "openai/gpt-4o",
				TotalContext: 128000,
				MaxOutput:    16400,
				InputPrice:   250,
				OutputPrice:  1000,
			},
			{
				Name:         "GPT-4.1-mini",
				Slug:         "openai/gpt-4.1-mini",
				TotalContext: 128000,
				MaxOutput:    16400,
				InputPrice:   15,
				OutputPrice:  60,
			},
			{
				Name:         "Qwen Plus (balanced)",
				Slug:         "qwen/qwen-plus",
				TotalContext: 131100,
				MaxOutput:    8200,
				InputPrice:   40,
				OutputPrice:  120,
			},
			{
				Name:         "Qwen Turbo (fast)",
				Slug:         "qwen/qwen-turbo",
				TotalContext: 1000000,
				MaxOutput:    8200,
				InputPrice:   5,
				OutputPrice:  20,
			},
			{
				Name:         "Gemini 2.5 Flash (fast)",
				Slug:         "google/gemini-2.5-flash",
				TotalContext: 1050000,
				MaxOutput:    65500,
				InputPrice:   30,
				OutputPrice:  250,
			},
		}
	} else {
		models = []*chatv2.SupportedModel{
			{
				Name:         "GPT-4.1",
				Slug:         openai.ChatModelGPT4_1,
				TotalContext: 1050000,
				MaxOutput:    32800,
				InputPrice:   200,
				OutputPrice:  800,
			},
			{
				Name:         "GPT-4o",
				Slug:         openai.ChatModelGPT4o,
				TotalContext: 128000,
				MaxOutput:    16400,
				InputPrice:   250,
				OutputPrice:  1000,
			},
			{
				Name:         "GPT-4.1-mini",
				Slug:         openai.ChatModelGPT4_1Mini,
				TotalContext: 128000,
				MaxOutput:    16400,
				InputPrice:   15,
				OutputPrice:  60,
			},
			// TODO: add user custom models
		}
	}

	return &chatv2.ListSupportedModelsResponse{
		Models: models,
	}, nil
}
