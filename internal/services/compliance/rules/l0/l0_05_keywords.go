package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
	"strings"
)

// L0-05: 关键词数量异常
type KeywordsRule struct{}

func (r *KeywordsRule) ID() string   { return "L0-05" }
func (r *KeywordsRule) Name() string { return "关键词数量异常" }

func (r *KeywordsRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// Simple regex to find Keywords line
	re := regexp.MustCompile(`(?i)(关键词|Key\s*words)[:：]\s*(.*)`)
	matches := re.FindStringSubmatch(content)
	if len(matches) < 3 {
		return &rules.CheckResult{
			MetricID: r.ID(),
			Score:    1,
			Level:    "high",
			Evidence: []rules.Evidence{{Section: "元数据", Reason: "未找到关键词行"}},
			Notes:    "请在内容中添加关键词行，格式如：关键词：A；B；C",
		}, nil
	}

	keywordsStr := matches[2]
	// Split by typical separators
	sepRe := regexp.MustCompile(`[,;，；]`)
	keywords := sepRe.Split(keywordsStr, -1)

	// Filter empty
	var validKeywords []string
	for _, k := range keywords {
		if strings.TrimSpace(k) != "" {
			validKeywords = append(validKeywords, strings.TrimSpace(k))
		}
	}
	count := len(validKeywords)

	minK, _ := settings.Threshold["min_keywords"].(int)
	maxK, _ := settings.Threshold["max_keywords"].(int)

	if count >= minK && (count <= maxK || maxK == 0) {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "关键词数量符合规范。"}, nil
	}

	level := "med"
	if count < minK {
		level = "high"
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.5,
		Level:    level,
		Evidence: []rules.Evidence{{
			Section: "元数据",
			Quote:   fmt.Sprintf("识别到 %d 个关键词", count),
			Reason:  fmt.Sprintf("关键词数量不在要求范围 (%d-%d) 内", minK, maxK),
		}},
		Notes: fmt.Sprintf("当前有 %d 个关键词，建议调整为 %d-%d 个。", count, minK, maxK),
	}, nil
}
