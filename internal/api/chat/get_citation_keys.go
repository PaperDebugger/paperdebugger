package chat

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/models"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
)

func (s *ChatServerV2) GetCitationKeys(
	ctx context.Context,
	req *chatv2.GetCitationKeysRequest,
) (*chatv2.GetCitationKeysResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := s.userService.GetUserSettings(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	llmProvider := &models.LLMProviderConfig{
		APIKey: settings.OpenAIAPIKey,
	}

	citationKeys, err := s.aiClientV2.GetCitationKeys(
		ctx,
		req.GetSentence(),
		req.GetBibliography(),
		actor.ID,
		req.GetProjectId(),
		llmProvider,
	)
	if err != nil {
		return nil, err
	}

	return &chatv2.GetCitationKeysResponse{
		CitationKeys: citationKeys,
	}, nil
}
