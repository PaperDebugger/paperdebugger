package usage

import (
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	usagev1 "paperdebugger/pkg/gen/api/usage/v1"
)

type UsageServer struct {
	usagev1.UnimplementedUsageServiceServer

	usageService *services.UsageService
	logger       *logger.Logger
}

func NewUsageServer(
	usageService *services.UsageService,
	logger *logger.Logger,
) usagev1.UsageServiceServer {
	return &UsageServer{
		usageService: usageService,
		logger:       logger,
	}
}

// convertModelsToProto converts ModelUsageStats to proto format.
// Costs are already calculated by the service layer.
func convertModelsToProto(models map[string]*services.ModelUsageStats) map[string]*usagev1.ModelTokens {
	protoModels := make(map[string]*usagev1.ModelTokens, len(models))

	for modelName, stats := range models {
		protoModels[modelName] = &usagev1.ModelTokens{
			PromptTokens:     stats.PromptTokens,
			CompletionTokens: stats.CompletionTokens,
			TotalTokens:      stats.TotalTokens,
			RequestCount:     stats.RequestCount,
			CostUsd:          stats.CostUSD,
		}
	}

	return protoModels
}
