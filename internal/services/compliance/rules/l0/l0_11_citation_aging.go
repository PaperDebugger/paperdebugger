package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
	"strconv"
	"time"
)

// L0-11: 参考文献时效性差
type CitationAgingRule struct{}

func (r *CitationAgingRule) ID() string   { return "L0-11" }
func (r *CitationAgingRule) Name() string { return "参考文献时效性差" }

func (r *CitationAgingRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// Heuristic: look for 4-digit years in bibitems
	re := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	years := re.FindAllString(content, -1)

	if len(years) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "未识别到文献年份，跳过检查。"}, nil
	}

	currentYear := time.Now().Year()
	maxAge, _ := settings.Threshold["max_age_years"].(int)
	if maxAge == 0 {
		maxAge = 10
	}

	var oldRefs int
	var recentRefs int
	for _, yStr := range years {
		y, _ := strconv.Atoi(yStr)
		if currentYear-y > maxAge {
			oldRefs++
		}
		if currentYear-y <= 5 {
			recentRefs++
		}
	}

	oldPct := float64(oldRefs) / float64(len(years))
	recentPct := float64(recentRefs) / float64(len(years))
	minRecentPct, _ := settings.Threshold["min_recent_pct"].(float64)

	var evidence []rules.Evidence
	if oldPct > 0.5 {
		evidence = append(evidence, rules.Evidence{Section: "参考文献", Reason: fmt.Sprintf("超过 50%% 的文献超过 %d 年", maxAge)})
	}
	if recentPct < minRecentPct && minRecentPct > 0 {
		evidence = append(evidence, rules.Evidence{Section: "参考文献", Reason: fmt.Sprintf("近 5 年文献占比 (%.1f%%) 低于建议比例 (%.1f%%)", recentPct*100, minRecentPct*100)})
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "文献时效性良好，近 5 年文献充足。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.4,
		Level:    "med",
		Evidence: evidence,
		Notes:    "建议增加近 3-5 年的学术前沿文献，减少过旧的参考资料。",
	}, nil
}
