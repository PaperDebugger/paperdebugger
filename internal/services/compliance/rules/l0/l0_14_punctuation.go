package l0

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
	"strings"
)

// L0-14: 标点符号使用不规范
type PunctuationRule struct{}

func (r *PunctuationRule) ID() string   { return "L0-14" }
func (r *PunctuationRule) Name() string { return "标点符号使用不规范" }

func (r *PunctuationRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	var evidence []rules.Evidence

	// Check for common mixed punctuation issues (heuristics)
	// 1. Chinese text followed by English punctuation (e.g. "中文.")
	zhEnPunc := regexp.MustCompile(`[\p{Han}][.,;!?]`)
	if matches := zhEnPunc.FindAllString(content, 5); len(matches) > 0 {
		evidence = append(evidence, rules.Evidence{
			Section: "正文标点",
			Quote:   strings.Join(matches, ", "),
			Reason:  "中文文本后使用了英文标点",
		})
	}

	// 2. English text followed by Chinese punctuation (e.g. "English。")
	enZhPunc := regexp.MustCompile(`[a-zA-Z][，。；：！？]`)
	if matches := enZhPunc.FindAllString(content, 5); len(matches) > 0 {
		evidence = append(evidence, rules.Evidence{
			Section: "正文标点",
			Quote:   strings.Join(matches, ", "),
			Reason:  "英文文本后使用了中文标点",
		})
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "标点符号使用基本规范。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.3,
		Level:    "med",
		Evidence: evidence,
		Notes:    "请确保中英文标点的一致性，中文正文通常使用全角标点，英文参考文献及段落使用半角标点。"}, nil
}
