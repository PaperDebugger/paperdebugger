package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"strings"
)

type ChapterBalanceRule struct{}

func (r *ChapterBalanceRule) ID() string   { return "L0-02" }
func (r *ChapterBalanceRule) Name() string { return "各章节字数失衡" }

func (r *ChapterBalanceRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {

	content, err := doc.GetFullContent()
	if err != nil {
		return nil, fmt.Errorf("failed to get full content: %w", err)
	}

	totalWords := len(strings.Fields(content))
	if totalWords == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Level: "low", Score: 0, Notes: "文档内容为空，跳过检查。"}, nil
	}

	expectedBalance, _ := settings.Threshold["expected_balance"].([]map[string]any)
	var evidence []rules.Evidence
	var totalScore float64

	for _, rule := range expectedBalance {
		pattern, _ := rule["pattern"].(string)
		minPct, _ := rule["min_pct"].(float64)
		maxPct, _ := rule["max_pct"].(float64)

		sectionText := rules.ExtractSection(content, pattern)

		sectionWords := len(strings.Fields(sectionText))
		pct := float64(sectionWords) / float64(totalWords)

		if pct < minPct {
			score := (minPct - pct) / minPct
			totalScore += score
			evidence = append(evidence, rules.Evidence{
				Section: pattern,
				Quote:   fmt.Sprintf("占比: %.1f%%", pct*100),
				Reason:  fmt.Sprintf("低于建议占比 (%.1f%%-%.1f%%)", minPct*100, maxPct*100),
			})

		} else if pct > maxPct {
			score := (pct - maxPct) / (1 - maxPct)
			totalScore += score
			evidence = append(evidence, rules.Evidence{
				Section: pattern,
				Quote:   fmt.Sprintf("占比: %.1f%%", pct*100),
				Reason:  fmt.Sprintf("高于建议占比 (%.1f%%-%.1f%%)", minPct*100, maxPct*100),
			})

		}
	}

	level := "low"
	if len(evidence) > 0 {
		level = "med"
		if totalScore > 0.5 {
			level = "high"
		}
	}

	score := totalScore
	if score > 1 {
		score = 1
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    score,
		Level:    level,
		Evidence: evidence,
		Notes:    "请根据各章节建议占比调整内容详情，避免头重脚轻或核心章节过薄。",
	}, nil
}
