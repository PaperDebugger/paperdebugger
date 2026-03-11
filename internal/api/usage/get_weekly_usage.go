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

	// Get weekly stats with costs already calculated by the service layer
	stats, err := s.usageService.GetWeeklyUsageWithCosts(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	return &usagev1.GetWeeklyUsageResponse{
		Usage: &usagev1.WeeklyUsage{
			Models:       convertModelsToProto(stats.Models),
			SessionCount: stats.SessionCount,
			TotalCostUsd: stats.TotalCostUSD,
		},
	}, nil
}
