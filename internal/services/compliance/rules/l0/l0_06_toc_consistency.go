package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
)

// L0-06: 目录与正文不一致
type TOCConsistencyRule struct{}

func (r *TOCConsistencyRule) ID() string   { return "L0-06" }
func (r *TOCConsistencyRule) Name() string { return "目录与正文不一致" }

func (r *TOCConsistencyRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// Extract all sectioning commands
	re := regexp.MustCompile(`\\(chapter|section|subsection|subsubsection)\*?\{([^}]+)\}`)
	matches := re.FindAllStringSubmatch(content, -1)

	if len(matches) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "未检测到章节结构，跳过检查。"}, nil
	}

	var evidence []rules.Evidence
	var prevLevel int

	// Map level names to numbers
	levels := map[string]int{
		"chapter":       1,
		"section":       2,
		"subsection":    3,
		"subsubsection": 4,
	}

	for i, m := range matches {
		currType := m[1]
		currLevel := levels[currType]

		if i > 0 {
			// Check for level jumps (e.g. section to subsubsection)
			if currLevel > prevLevel+1 {
				evidence = append(evidence, rules.Evidence{
					Section: m[2],
					Quote:   m[0],
					Reason:  fmt.Sprintf("章节级别跳跃: 从 %d 级直接跳到 %d 级", prevLevel, currLevel),
				})
			}
		}
		prevLevel = currLevel
	}

	if len(evidence) == 0 {
		return &rules.CheckResult{MetricID: r.ID(), Score: 0, Level: "low", Notes: "章节层级结构完整，未发现异常跳跃。"}, nil
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    0.4,
		Level:    "med",
		Evidence: evidence,
		Notes:    "请检查标题层级是否正确（例如：1级标题下应为2级标题，不应直接出现3级标题）。",
	}, nil
}
