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

	return &usagev1.GetWeeklyUsageResponse{
		Usage: &usagev1.WeeklyUsage{
			PromptTokens:     stats.PromptTokens,
			CompletionTokens: stats.CompletionTokens,
			TotalTokens:      stats.TotalTokens,
			RequestCount:     stats.RequestCount,
			SessionCount:     stats.SessionCount,
		},
	}, nil
}
