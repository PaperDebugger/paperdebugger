package usage

import (
	"paperdebugger/internal/libs/logger"
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
