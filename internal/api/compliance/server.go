package compliance

import (
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/compliance"
	compliancev1 "paperdebugger/pkg/gen/api/compliance/v1"
)

type ComplianceServer struct {
	compliancev1.UnimplementedComplianceServiceServer
	complianceService *compliance.ComplianceService
	projectService    *services.ProjectService
}

func NewComplianceServer(
	complianceService *compliance.ComplianceService,
	projectService *services.ProjectService,
) compliancev1.ComplianceServiceServer {
	return &ComplianceServer{
		complianceService: complianceService,
		projectService:    projectService,
	}
}
