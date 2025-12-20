package l2

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
)

// L2 rules focus on deep innovations, cross-paper comparison, and complex reasoning.
// Placeholders for future indicators.

type InnovationCheckRule struct {
	rules.BaseAIRule
}

func (r *InnovationCheckRule) ID() string   { return "L2-01" }
func (r *InnovationCheckRule) Name() string { return "研究创新性评估" }

func (r *InnovationCheckRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "L2 规则暂未启用。"}, nil
}
