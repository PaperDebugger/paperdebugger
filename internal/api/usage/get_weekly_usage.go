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

	// Convert models map to proto format and calculate costs
	protoModels := make(map[string]*usagev1.ModelTokens)
	var totalCostUSD float64
	for modelName, tokens := range stats.Models {
		var costUSD float64
		if pricing, ok := pricingMap[modelName]; ok && pricing != nil {
			costUSD = float64(tokens.PromptTokens)*pricing.PromptPrice +
				float64(tokens.CompletionTokens)*pricing.CompletionPrice
			totalCostUSD += costUSD
		}
		protoModels[modelName] = &usagev1.ModelTokens{
			PromptTokens:     tokens.PromptTokens,
			CompletionTokens: tokens.CompletionTokens,
			TotalTokens:      tokens.TotalTokens,
			RequestCount:     tokens.RequestCount,
			CostUsd:          costUSD,
		}
	}

	return &usagev1.GetWeeklyUsageResponse{
		Usage: &usagev1.WeeklyUsage{
			Models:       protoModels,
			SessionCount: stats.SessionCount,
			TotalCostUsd: totalCostUSD,
		},
	}, nil
}
