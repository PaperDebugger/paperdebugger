package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
)

// L0-09: 参考文献数量异常
type CitationCountRule struct{}

func (r *CitationCountRule) ID() string   { return "L0-09" }
func (r *CitationCountRule) Name() string { return "参考文献数量异常" }

func (r *CitationCountRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	re := regexp.MustCompile(`\\bibitem`)
	count := len(re.FindAllString(content, -1))

	minRefs, _ := settings.Threshold["min_refs"].(int)
	maxRefs, _ := settings.Threshold["max_refs"].(int)

	if count >= minRefs && (count <= maxRefs || maxRefs == 0) {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "参考文献数量符合规范。"}, nil
	}

	level := "med"
	if count < minRefs {
		level = "high"
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.5,
		Level:    level,
		Evidence: []rules.Evidence{{Section: "参考文献", Quote: fmt.Sprintf("识别到 %d 条文献", count), Reason: fmt.Sprintf("文献数量不在建议范围 (%d-%d) 内", minRefs, maxRefs)}},
		Notes:    fmt.Sprintf("当前文献数量为 %d，建议根据学术规范进行增删。", count),
	}, nil
}
