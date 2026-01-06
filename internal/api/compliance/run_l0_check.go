package compliance

import (
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	compliancev1 "paperdebugger/pkg/gen/api/compliance/v1"
)

func (s *ComplianceServer) RunL0Check(req *compliancev1.RunL0CheckRequest, stream compliancev1.ComplianceService_RunL0CheckServer) error {
	ctx := stream.Context()
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return shared.ErrInvalidActor("user not authenticated")
	}

	project, err := s.projectService.GetProject(ctx, actor.ID, req.ProjectId)
	if err != nil {
		return shared.ErrRecordNotFound("project not found")
	}

	// Progress callback
	onProgress := func(progress float32) {
		_ = stream.Send(&compliancev1.RunL0CheckResponse{
			Payload: &compliancev1.RunL0CheckResponse_Progress{
				Progress: progress,
			},
		})
	}

	// For now, use default school/major/program
	results, err := s.complianceService.Audit(ctx, project, "default", "default", "default", onProgress)
	if err != nil {
		return shared.ErrInternal("failed to run compliance check")
	}

	var respResults []*compliancev1.CheckResult
	for _, res := range results {
		if !s.isL0(res.MetricID) {
			continue
		}

		evidences := make([]*compliancev1.Evidence, 0, len(res.Evidence))
		for _, ev := range res.Evidence {
			evidences = append(evidences, &compliancev1.Evidence{
				Section: ev.Section,
				Quote:   ev.Quote,
				Reason:  ev.Reason,
			})
		}

		respResults = append(respResults, &compliancev1.CheckResult{
			MetricId: res.MetricID,
			Name:     res.Name,
			Score:    res.Score,
			Level:    res.Level,
			Notes:    res.Notes,
			Evidence: evidences,
		})
	}

	return stream.Send(&compliancev1.RunL0CheckResponse{
		Payload: &compliancev1.RunL0CheckResponse_Results{
			Results: &compliancev1.CheckResults{
				Results: respResults,
			},
		},
	})
}

func (s *ComplianceServer) isL0(id string) bool {
	return len(id) >= 2 && id[:2] == "L0"
}
