package usage

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/models"
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

	// Get pricing map for cost calculation
	pricingMap, err := s.pricingService.GetPricingMap(ctx)
	if err != nil {
		s.logger.Warn("Failed to get pricing map", "error", err)
		pricingMap = make(map[string]*models.ModelPricing)
	}

	// Convert to common TokenStats format
	modelsMap := make(map[string]TokenStats, len(stats.Models))
	for modelName, tokens := range stats.Models {
		modelsMap[modelName] = TokenStats{
			PromptTokens:     tokens.PromptTokens,
			CompletionTokens: tokens.CompletionTokens,
			TotalTokens:      tokens.TotalTokens,
			RequestCount:     tokens.RequestCount,
		}
	}

	protoModels, totalCostUSD := convertModelsToProto(modelsMap, pricingMap)

	return &usagev1.GetWeeklyUsageResponse{
		Usage: &usagev1.WeeklyUsage{
			Models:       protoModels,
			SessionCount: stats.SessionCount,
			TotalCostUsd: totalCostUSD,
		},
	}, nil
}
