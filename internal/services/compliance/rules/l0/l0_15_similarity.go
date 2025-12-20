package l0

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
	"strings"
)

// L0-15: 语句重复率过高
type SimilarityRule struct{}

func (r *SimilarityRule) ID() string   { return "L0-15" }
func (r *SimilarityRule) Name() string { return "相似语句过多" }

func (r *SimilarityRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {

	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// Naive check for repeated sentences
	sentences := regexp.MustCompile(`[。！？.!?]`).Split(content, -1)
	counts := make(map[string]int)
	var evidence []rules.Evidence

	threshold, _ := settings.Threshold["similarity_threshold"].(float64)
	if threshold == 0 {
		threshold = 0.8
	}

	for _, s := range sentences {
		s = strings.TrimSpace(s)
		if len(s) < 20 { // Ignore short common phrases
			continue
		}
		counts[s]++
		if counts[s] == 2 {
			evidence = append(evidence, rules.Evidence{
				Section: "内容分析",
				Quote:   s,
				Reason:  "在该文档中多次出现完全一致的句子",
			})
		}

	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "未发现明显重复的高重合度语句。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    float64(len(evidence)) / 10.0, // Heuristic
		Level:    "med",
		Evidence: evidence,
		Notes:    "正文中存在多处高度重复的句子，建议优化表达，避免内容灌水或复制粘贴错误。",
	}, nil
}
