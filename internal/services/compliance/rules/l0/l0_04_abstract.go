package l0

import (
	"context"
	_ "embed"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"strings"
)

//go:embed prompts/abstract.tmpl
var abstractPrompt string

type AbstractRule struct {
	rules.BaseAIRule
}

func (r *AbstractRule) ID() string   { return "L0-04" }
func (r *AbstractRule) Name() string { return "摘要结构不完整" }

func (r *AbstractRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {

	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// 1. Extract abstract text
	abstractText := rules.ExtractSection(content, "摘要|Abstract")
	if abstractText == "" {

		return &rules.CheckResult{
			MetricID: r.ID(),
			Level:    "high",
			Score:    1,
			Evidence: []rules.Evidence{{Section: "摘要", Reason: "未找到摘要内容"}},
			Notes:    "请确保论文包含及时的摘要章节。",
		}, nil

	}

	// 2. Programmatic checks
	paragraphs := strings.Split(strings.TrimSpace(abstractText), "\n\n")
	pCount := len(paragraphs)

	minP, _ := settings.Threshold["min_paragraphs"].(int)
	maxP, _ := settings.Threshold["max_paragraphs"].(int)
	reqKeywords, _ := settings.Threshold["required_keywords"].([]string)

	var evidence []rules.Evidence
	if pCount < minP || (pCount > maxP && maxP > 0) {
		evidence = append(evidence, rules.Evidence{
			Section: "摘要",
			Quote:   fmt.Sprintf("段落数: %d", pCount),
			Reason:  fmt.Sprintf("摘要段落数量异常 (建议 %d-%d 段)", minP, maxP),
		})
	}

	// Check for key elements keywords (e.g. Purpose, Method, Result, Conclusion)
	var missingElements []string
	for _, k := range reqKeywords {
		if !strings.Contains(abstractText, k) {
			missingElements = append(missingElements, k)
		}
	}

	if len(missingElements) > 0 {
		evidence = append(evidence, rules.Evidence{
			Section: "摘要",
			Reason:  fmt.Sprintf("摘要文本可能缺失关键要素词: %s", strings.Join(missingElements, ", ")),
		})
	}

	// 3. AI Hybrid part (Placeholder)
	// In a real implementation, we would call LLM here with base.tmpl and the specific prompt.
	// For now, if programmatic checks failed, we return med/high.

	level := "low"
	score := 0.0
	if len(evidence) > 0 {
		level = "med"
		score = 0.5
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    score,
		Level:    level,
		Evidence: evidence,
		Notes:    "摘要应简洁明了，包含研究目的、方法、主要结果和结论四要素。建议根据缺失词补充相关描述。",
	}, nil

}
