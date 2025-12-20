package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"strings"
)

// L0-17: 公式/代码块格式异常
type BlockFormatRule struct{}

func (r *BlockFormatRule) ID() string   { return "L0-17" }
func (r *BlockFormatRule) Name() string { return "公式/代码块格式异常" }

func (r *BlockFormatRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	var evidence []rules.Evidence

	// Check for unclosed environments (simplistic)
	envs := []string{"equation", "align", "table", "figure", "lstlisting"}
	for _, env := range envs {
		starts := strings.Count(content, "\\begin{"+env+"}")
		ends := strings.Count(content, "\\end{"+env+"}")
		if starts != ends {
			evidence = append(evidence, rules.Evidence{
				Section: "环境校验",
				Reason:  fmt.Sprintf("环境 %s 的 \\begin 和 \\end 数量不匹配 (begin: %d, end: %d)", env, starts, ends),
			})
		}
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "公式及环境格式校验通过。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.3,
		Level:    "med",
		Evidence: evidence,
		Notes:    "请检查 LaTeX 环境的完整性。",
	}, nil
}
