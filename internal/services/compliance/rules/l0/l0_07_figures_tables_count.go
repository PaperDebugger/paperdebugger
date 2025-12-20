package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
)

// L0-07: 图表总数异常
type FiguresTablesCountRule struct{}

func (r *FiguresTablesCountRule) ID() string   { return "L0-07" }
func (r *FiguresTablesCountRule) Name() string { return "图表总数异常" }

func (r *FiguresTablesCountRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	figRe := regexp.MustCompile(`\\begin\{figure\}`)
	tabRe := regexp.MustCompile(`\\begin\{table\}`)

	figs := len(figRe.FindAllString(content, -1))
	tabs := len(tabRe.FindAllString(content, -1))

	minFigs, _ := settings.Threshold["min_figures"].(int)
	minTabs, _ := settings.Threshold["min_tables"].(int)

	var evidence []rules.Evidence
	if figs < minFigs {
		evidence = append(evidence, rules.Evidence{Section: "图表", Reason: fmt.Sprintf("图表数量 (%d) 低于建议数量 (%d)，可能缺乏数据支撑。", figs, minFigs)})
	}
	if tabs < minTabs {
		evidence = append(evidence, rules.Evidence{Section: "图表", Reason: fmt.Sprintf("表格数量 (%d) 低于建议数量 (%d)。", tabs, minTabs)})
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "图表数量符合建议。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.3,
		Level:    "med",
		Evidence: evidence,
		Notes:    "若论文为实证或实验型，建议增加必要的图表以增强说服力。",
	}, nil
}
