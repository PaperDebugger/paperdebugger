package l0

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
)

// L0-20: AI 生成痕迹检测
type AIDetectionRule struct {
	rules.BaseAIRule
}

func (r *AIDetectionRule) ID() string   { return "L0-20" }
func (r *AIDetectionRule) Name() string { return "AI 生成痕迹检测" }

func (r *AIDetectionRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	// AI placeholder
	return &rules.CheckResult{MetricID: r.ID(), Level: "low", Score: 0, Notes: "(placeholder) AI 检测度较低。"}, nil
}
