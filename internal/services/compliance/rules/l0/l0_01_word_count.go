package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"strings"
)

type TotalWordCountRule struct{}

func (r *TotalWordCountRule) ID() string   { return "L0-01" }
func (r *TotalWordCountRule) Name() string { return "总字数异常" }

func (r *TotalWordCountRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {

	content, err := doc.GetFullContent()
	if err != nil {
		return nil, fmt.Errorf("failed to get full content: %w", err)
	}

	// Simple word count: split by whitespace
	words := strings.Fields(content)
	count := len(words)

	minWords, _ := settings.Threshold["min_words"].(int)
	maxWords, _ := settings.Threshold["max_words"].(int)

	result := &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0,
		Level:    "low",
		Notes:    "总字数在正常范围内。",
	}

	if count < minWords {
		result.Score = float64(minWords-count) / float64(minWords)
		result.Level = "high"
		result.Evidence = []rules.Evidence{
			{
				Section: "全文",
				Quote:   fmt.Sprintf("当前字数: %d", count),
				Reason:  fmt.Sprintf("总字数低于学校最低要求 (%d)", minWords),
			},
		}

		result.Notes = fmt.Sprintf("建议增加约 %d 字以达到最低标准。", minWords-count)
	} else if count > maxWords && maxWords > 0 {
		result.Score = float64(count-maxWords) / float64(maxWords)
		if result.Score > 1 {
			result.Score = 1
		}
		result.Level = "med"
		result.Evidence = []rules.Evidence{
			{
				Section: "全文",
				Quote:   fmt.Sprintf("当前字数: %d", count),
				Reason:  fmt.Sprintf("总字数超过学校建议上限 (%d)", maxWords),
			},
		}

		result.Notes = "字数略多，请检查是否有冗余章节或过于繁琐的描述。"
	}

	return result, nil
}
