package l0

import (
	"context"
	_ "embed"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
)

//go:embed prompts/translation.tmpl
var translationPrompt string

// L0-16: 翻译痕迹明显
type TranslationRule struct {
	rules.BaseAIRule
}

func (r *TranslationRule) ID() string   { return "L0-16" }
func (r *TranslationRule) Name() string { return "翻译痕迹明显" }

func (r *TranslationRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	// AI placeholder
	return &rules.CheckResult{MetricID: r.ID(), Level: "low", Score: 0, Notes: "(placeholder) 未检测到明显的非母语表达或机器翻译痕迹。"}, nil
}
