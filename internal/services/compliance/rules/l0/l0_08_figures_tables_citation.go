package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
	"strings"
)

// L0-08: 图表无引用
type FiguresTablesCitationRule struct{}

func (r *FiguresTablesCitationRule) ID() string   { return "L0-08" }
func (r *FiguresTablesCitationRule) Name() string { return "图表无引用" }

func (r *FiguresTablesCitationRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// 1. Extract labels
	labelRe := regexp.MustCompile(`\\label\{([^}]+)\}`)
	labels := labelRe.FindAllStringSubmatch(content, -1)

	var evidence []rules.Evidence
	for _, m := range labels {
		label := m[1]
		// Check if it's a figure or table label (heuristic)
		if !strings.HasPrefix(label, "fig:") && !strings.HasPrefix(label, "tab:") && !strings.Contains(label, "fig") && !strings.Contains(label, "tab") {
			continue
		}

		// Look for \ref{label} or \cite{label} (unlikely for figs but safety)
		refRe := regexp.MustCompile(`\\ref\{` + regexp.QuoteMeta(label) + `\}`)
		if !refRe.MatchString(content) {
			evidence = append(evidence, rules.Evidence{
				Section: "交叉引用",
				Quote:   fmt.Sprintf("\\label{%s}", label),
				Reason:  fmt.Sprintf("图表标签 %s 在正文中未被引用", label),
			})
		}
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "所有图表均已在正文中引用。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.5,
		Level:    "med",
		Evidence: evidence,
		Notes:    "正文必须通过“如图x所示”或“见表y”明确引用所有附图和附表。",
	}, nil
}
