package l0

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"strings"
)

// L0-18: 页码/页眉/页脚缺失
// L0-19: 字体/字号不符合规范
// Both are hard to check in raw text, looking for specific commands.
type LayoutRule struct{}

func (r *LayoutRule) ID() string   { return "L0-18" }
func (r *LayoutRule) Name() string { return "排版布局异常" }

func (r *LayoutRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	var evidence []rules.Evidence
	// Heuristic: Check if fancyhdr is used if multiple pages
	if !strings.Contains(content, "fancyhdr") && !strings.Contains(content, "pagestyle") {
		evidence = append(evidence, rules.Evidence{Section: "布局", Reason: "未检测到页码或页眉页脚设置 (fancyhdr)"})
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "检测到布局设置。"}, nil
	}

	return &rules.CheckResult{MetricID: r.ID(), Score: 0.2, Level: "low", Evidence: evidence, Notes: "建议检查学校 LaTeX 模板是否正确加载。"}, nil
}
