package usage

import (
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	usagev1 "paperdebugger/pkg/gen/api/usage/v1"
)

type UsageServer struct {
	usagev1.UnimplementedUsageServiceServer

	usageService   *services.UsageService
	pricingService *services.PricingService
	logger         *logger.Logger
}

func NewUsageServer(
	usageService *services.UsageService,
	pricingService *services.PricingService,
	logger *logger.Logger,
) usagev1.UsageServiceServer {
	return &UsageServer{
		usageService:   usageService,
		pricingService: pricingService,
		logger:         logger,
	}
}

// TokenStats represents common token statistics used for cost calculation.
type TokenStats struct {
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
	RequestCount     int64
}

// convertModelsToProto converts model token stats to proto format and calculates costs.
// Returns the proto models map and total cost in USD.
func convertModelsToProto(
	modelsMap map[string]TokenStats,
	pricingMap map[string]*models.ModelPricing,
) (map[string]*usagev1.ModelTokens, float64) {
	protoModels := make(map[string]*usagev1.ModelTokens, len(modelsMap))
	var totalCostUSD float64

	for modelName, tokens := range modelsMap {
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

	return protoModels, totalCostUSD
}
