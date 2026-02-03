package chat

import (
	"context"
	"strings"

	"paperdebugger/internal/libs/contextutil"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v3"
)

// modelConfig holds model configuration including whether it requires user's own API key
type modelConfig struct {
	name           string
	slugOpenRouter string // Slug for OpenRouter API (used when user doesn't provide own key)
	slugOpenAI     string // Slug for OpenAI API (used when user provides own key)
	totalContext   int64
	maxOutput      int64
	inputPrice     int64
	outputPrice    int64
	requireOwnKey  bool // If true, this model requires user to provide their own API key
}

// allModels defines all available models in the system
var allModels = []modelConfig{
	{
		name:           "GPT-5.1",
		slugOpenRouter: "openai/gpt-5.1",
		slugOpenAI:     openai.ChatModelGPT5_1,
		totalContext:   400000,
		maxOutput:      128000,
		inputPrice:     125,  // $1.25
		outputPrice:    1000, // $10.00
		requireOwnKey:  false,
	},
	{
		name:           "GPT-5.2",
		slugOpenRouter: "openai/gpt-5.2",
		slugOpenAI:     openai.ChatModelGPT5_2,
		totalContext:   400000,
		maxOutput:      128000,
		inputPrice:     175,  // $1.75
		outputPrice:    1400, // $14.00
		requireOwnKey:  true,
	},
	{
		name:           "GPT-5 Mini",
		slugOpenRouter: "openai/gpt-5-mini",
		slugOpenAI:     openai.ChatModelGPT5Mini,
		totalContext:   400000,
		maxOutput:      128000,
		inputPrice:     25,
		outputPrice:    200,
		requireOwnKey:  false,
	},
	{
		name:           "GPT-5 Nano",
		slugOpenRouter: "openai/gpt-5-nano",
		slugOpenAI:     openai.ChatModelGPT5Nano,
		totalContext:   400000,
		maxOutput:      128000,
		inputPrice:     5,  // $0.20
		outputPrice:    40, // $0.80
		requireOwnKey:  false,
	},
	{
		name:           "GPT-4.1",
		slugOpenRouter: "openai/gpt-4.1",
		slugOpenAI:     openai.ChatModelGPT4_1,
		totalContext:   1050000,
		maxOutput:      32800,
		inputPrice:     200, // $2.00
		outputPrice:    800,
		requireOwnKey:  false,
	},
	{
		name:           "GPT-4.1-mini",
		slugOpenRouter: "openai/gpt-4.1-mini",
		slugOpenAI:     openai.ChatModelGPT4_1Mini,
		totalContext:   128000,
		maxOutput:      16400,
		inputPrice:     15,
		outputPrice:    60,
		requireOwnKey:  false,
	},
	{
		name:           "GPT-4o",
		slugOpenRouter: "openai/gpt-4o",
		slugOpenAI:     openai.ChatModelGPT4o,
		totalContext:   128000,
		maxOutput:      16400,
		inputPrice:     250,
		outputPrice:    1000,
		requireOwnKey:  true,
	},
	{
		name:           "OpenAI: gpt-oss-120b (free)",
		slugOpenRouter: "openai/gpt-oss-120b:free",
		slugOpenAI:     "",
		totalContext:   131072,
		maxOutput:      131072,
		inputPrice:     0,
		outputPrice:    0,
		requireOwnKey:  false,
	},
	{
		name:           "Qwen Plus (balanced)",
		slugOpenRouter: "qwen/qwen-plus",
		slugOpenAI:     "", // OpenAI doesn't support Qwen, use OpenRouter slug
		totalContext:   131100,
		maxOutput:      8200,
		inputPrice:     40,
		outputPrice:    120,
		requireOwnKey:  false,
	},
	{
		name:           "Qwen Turbo (fast)",
		slugOpenRouter: "qwen/qwen-turbo",
		slugOpenAI:     "", // OpenAI doesn't support Qwen, use OpenRouter slug
		totalContext:   1000000,
		maxOutput:      8200,
		inputPrice:     5,
		outputPrice:    20,
		requireOwnKey:  false,
	},
	{
		name:           "Qwen3 Coder 480B A35B (free)",
		slugOpenRouter: "qwen/qwen3-coder:free",
		slugOpenAI:     "",
		totalContext:   262000,
		maxOutput:      262000,
		inputPrice:     0,
		outputPrice:    0,
		requireOwnKey:  false,
	},
	{
		name:           "GLM 4.5 Air (free)",
		slugOpenRouter: "z-ai/glm-4.5-air:free",
		slugOpenAI:     "",
		totalContext:   131072,
		maxOutput:      131072,
		inputPrice:     0,
		outputPrice:    0,
		requireOwnKey:  false,
	},
	{
		name:           "Gemini 2.5 Flash (fast)",
		slugOpenRouter: "google/gemini-2.5-flash",
		slugOpenAI:     "", // OpenAI doesn't support Gemini, use OpenRouter slug
		totalContext:   1050000,
		maxOutput:      65500,
		inputPrice:     30,
		outputPrice:    250,
		requireOwnKey:  false,
	},
	{
		name:           "Gemini 3 Flash Preview",
		slugOpenRouter: "google/gemini-3-flash-preview",
		slugOpenAI:     "", // OpenAI doesn't support Gemini, use OpenRouter slug
		totalContext:   1050000,
		maxOutput:      65500,
		inputPrice:     50,
		outputPrice:    300,
		requireOwnKey:  false,
	},
	{
		name:           "o1 Mini",
		slugOpenRouter: "openai/o1-mini",
		slugOpenAI:     openai.ChatModelO1Mini,
		totalContext:   128000,
		maxOutput:      65536,
		inputPrice:     300,  // $3.00
		outputPrice:    1200, // $12.00
		requireOwnKey:  true,
	},
	{
		name:           "o3",
		slugOpenRouter: "openai/o3",
		slugOpenAI:     openai.ChatModelO3,
		totalContext:   200000,
		maxOutput:      100000,
		inputPrice:     200,
		outputPrice:    800,
		requireOwnKey:  true,
	},
	{
		name:           "o3 Mini",
		slugOpenRouter: "openai/o3-mini",
		slugOpenAI:     openai.ChatModelO3Mini,
		totalContext:   200000,
		maxOutput:      100000,
		inputPrice:     110,
		outputPrice:    440,
		requireOwnKey:  true,
	},
	{
		name:           "o4 Mini",
		slugOpenRouter: "openai/o4-mini",
		slugOpenAI:     openai.ChatModelO4Mini,
		totalContext:   128000,
		maxOutput:      65536,
		inputPrice:     110,
		outputPrice:    440,
		requireOwnKey:  true,
	},
}

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

	hasOwnAPIKey := strings.TrimSpace(settings.OpenAIAPIKey) != ""

	var models []*chatv2.SupportedModel
	for _, config := range allModels {
		// Choose the appropriate slug based on whether user has their own API key.
		//
		// Some models are only available via OpenRouter; for those, slugOpenAI may be empty.
		// In that case, keep using the OpenRouter slug to avoid returning an empty model slug.
		slug := config.slugOpenRouter
		if hasOwnAPIKey && strings.TrimSpace(config.slugOpenAI) != "" {
			slug = config.slugOpenAI
		}

		// 	model := &chatv2.SupportedModel{
		// 		Name:         config.name,
		// 		Slug:         slug,
		// 		TotalContext: config.totalContext,
		// 		MaxOutput:    config.maxOutput,
		// 		InputPrice:   config.inputPrice,
		// 		OutputPrice:  config.outputPrice,
		// 	}

		// 	// If model requires own key but user hasn't provided one, mark as disabled
		// 	if config.requireOwnKey && !hasOwnAPIKey {
		// 		model.Disabled = true
		// 		model.DisabledReason = stringPtr("Requires your own OpenAI API key. Configure it in Settings.")
		// 	}

		// 	models = append(models, model)

		// 	models = []*chatv2.SupportedModel{
		// 	{
		// 		Name:          "GPT-4.1",
		// 		Slug:          "openai/gpt-4.1",
		// 		TotalContext:  1050000,
		// 		MaxOutput:     32800,
		// 		InputPrice:    200,
		// 		OutputPrice:   800,
		// 		CustomModelId: "",
		// 	},
		// 	{
		// 		Name:          "GPT-4.1-mini",
		// 		Slug:          "openai/gpt-4.1-mini",
		// 		TotalContext:  128000,
		// 		MaxOutput:     16400,
		// 		InputPrice:    15,
		// 		OutputPrice:   60,
		// 		CustomModelId: "",
		// 	},
		// 	{
		// 		Name:          "Qwen Plus (balanced)",
		// 		Slug:          "qwen/qwen-plus",
		// 		TotalContext:  131100,
		// 		MaxOutput:     8200,
		// 		InputPrice:    40,
		// 		OutputPrice:   120,
		// 		CustomModelId: "",
		// 	},
		// 	{
		// 		Name:          "Qwen Turbo (fast)",
		// 		Slug:          "qwen/qwen-turbo",
		// 		TotalContext:  1000000,
		// 		MaxOutput:     8200,
		// 		InputPrice:    5,
		// 		OutputPrice:   20,
		// 		CustomModelId: "",
		// 	},
		// 	{
		// 		Name:          "Gemini 2.5 Flash (fast)",
		// 		Slug:          "google/gemini-2.5-flash",
		// 		TotalContext:  1050000,
		// 		MaxOutput:     65500,
		// 		InputPrice:    30,
		// 		OutputPrice:   250,
		// 		CustomModelId: "",
		// 	},
		// 	{
		// 		Name:          "Gemini 3 Flash Preview",
		// 		Slug:          "google/gemini-3-flash-preview",
		// 		TotalContext:  1050000,
		// 		MaxOutput:     65500,
		// 		InputPrice:    50,
		// 		OutputPrice:   300,
		// 		CustomModelId: "",
		// 	},
		// }

		// for _, m := range settings.CustomModels {
		// 	models = slices.Insert(models, 0, &chatv2.SupportedModel{
		// 		Name:          m.Name,
		// 		Slug:          m.Slug,
		// 		TotalContext:  int64(m.ContextWindow),
		// 		MaxOutput:     int64(m.MaxOutput),
		// 		InputPrice:    int64(m.InputPrice),
		// 		OutputPrice:   int64(m.OutputPrice),
		// 		CustomModelId: m.ID.Hex(),
		// 	})
	}

	return &chatv2.ListSupportedModelsResponse{
		Models: models,
	}, nil
}

// stringPtr returns a pointer to the given string
func stringPtr(s string) *string {
	return &s
}
