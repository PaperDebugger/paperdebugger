package chat

import (
	"context"

	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2"
)

func (s *ChatServer) ListSupportedModels(
	ctx context.Context,
	req *chatv1.ListSupportedModelsRequest,
) (*chatv1.ListSupportedModelsResponse, error) {
	models := []*chatv1.SupportedModel{
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
		{

			Name: "GPT-5",
			Slug: openai.ChatModelGPT5,
		},
		{

			Name: "GPT-5-mini",
			Slug: openai.ChatModelGPT5Mini,
		},
		{

			Name: "GPT-5-nano",
			Slug: openai.ChatModelGPT5Nano,
		},
	}

	return &chatv1.ListSupportedModelsResponse{
		Models: models,
	}, nil
}
