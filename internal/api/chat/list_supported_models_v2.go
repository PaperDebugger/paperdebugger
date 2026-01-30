package chat

import (
	"context"
	"slices"

	"paperdebugger/internal/libs/contextutil"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
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
	models = []*chatv2.SupportedModel{
		{
			Name:          "GPT-4.1",
			Slug:          "openai/gpt-4.1",
			TotalContext:  1050000,
			MaxOutput:     32800,
			InputPrice:    200,
			OutputPrice:   800,
			CustomModelId: "",
		},
		{
			Name:          "GPT-4.1-mini",
			Slug:          "openai/gpt-4.1-mini",
			TotalContext:  128000,
			MaxOutput:     16400,
			InputPrice:    15,
			OutputPrice:   60,
			CustomModelId: "",
		},
		{
			Name:          "Qwen Plus (balanced)",
			Slug:          "qwen/qwen-plus",
			TotalContext:  131100,
			MaxOutput:     8200,
			InputPrice:    40,
			OutputPrice:   120,
			CustomModelId: "",
		},
		{
			Name:          "Qwen Turbo (fast)",
			Slug:          "qwen/qwen-turbo",
			TotalContext:  1000000,
			MaxOutput:     8200,
			InputPrice:    5,
			OutputPrice:   20,
			CustomModelId: "",
		},
		{
			Name:          "Gemini 2.5 Flash (fast)",
			Slug:          "google/gemini-2.5-flash",
			TotalContext:  1050000,
			MaxOutput:     65500,
			InputPrice:    30,
			OutputPrice:   250,
			CustomModelId: "",
		},
		{
			Name:          "Gemini 3 Flash Preview",
			Slug:          "google/gemini-3-flash-preview",
			TotalContext:  1050000,
			MaxOutput:     65500,
			InputPrice:    50,
			OutputPrice:   300,
			CustomModelId: "",
		},
	}

	for _, m := range settings.CustomModels {
		models = slices.Insert(models, 0, &chatv2.SupportedModel{
			Name:          m.Name,
			Slug:          m.Slug,
			TotalContext:  int64(m.ContextWindow),
			MaxOutput:     int64(m.MaxOutput),
			InputPrice:    int64(m.InputPrice),
			OutputPrice:   int64(m.OutputPrice),
			CustomModelId: m.ID.Hex(),
		})
	}

	return &chatv2.ListSupportedModelsResponse{
		Models: models,
	}, nil
}
