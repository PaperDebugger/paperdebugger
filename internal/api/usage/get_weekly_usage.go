package usage

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	usagev1 "paperdebugger/pkg/gen/api/usage/v1"
)

func (s *UsageServer) GetWeeklyUsage(
	ctx context.Context,
	req *usagev1.GetWeeklyUsageRequest,
) (*usagev1.GetWeeklyUsageResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	stats, err := s.usageService.GetWeeklyUsage(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	// Convert models map to proto format
	models := make(map[string]*usagev1.ModelTokens)
	for modelName, tokens := range stats.Models {
		models[modelName] = &usagev1.ModelTokens{
			PromptTokens:     tokens.PromptTokens,
			CompletionTokens: tokens.CompletionTokens,
			TotalTokens:      tokens.TotalTokens,
			RequestCount:     tokens.RequestCount,
		}
	}

	return &usagev1.GetWeeklyUsageResponse{
		Usage: &usagev1.WeeklyUsage{
			Models:       models,
			SessionCount: stats.SessionCount,
		},
	}, nil
}
