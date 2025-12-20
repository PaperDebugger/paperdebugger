package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
)

// L0-13: 参考文献引用缺失
type MissingCitationRefRule struct{}

func (r *MissingCitationRefRule) ID() string   { return "L0-13" }
func (r *MissingCitationRefRule) Name() string { return "参考文献引用缺失" }

func (r *MissingCitationRefRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// 1. Find all bibitem keys
	bibKeyRe := regexp.MustCompile(`\\bibitem\{([^}]+)\}`)
	keys := bibKeyRe.FindAllStringSubmatch(content, -1)

	var evidence []rules.Evidence
	for _, m := range keys {
		key := m[1]
		citeRe := regexp.MustCompile(`\\cite\{[^}]*` + regexp.QuoteMeta(key) + `[^}]*\}`)
		if !citeRe.MatchString(content) {
			evidence = append(evidence, rules.Evidence{
				Section: "参考文献",
				Quote:   fmt.Sprintf("\\bibitem{%s}", key),
				Reason:  fmt.Sprintf("文献条目 %s 在正文中未被引用", key),
			})
		}
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "所有文献条目均已在正文中引用。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.5,
		Level:    "med",
		Evidence: evidence,
		Notes:    "列出的参考文献必须在正文中有明确的引用标注。请检查是否有漏标。",
	}, nil
}
