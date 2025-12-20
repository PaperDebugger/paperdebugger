package l0

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"regexp"
)

type MissingChaptersRule struct{}

func (r *MissingChaptersRule) ID() string   { return "L0-03" }
func (r *MissingChaptersRule) Name() string { return "必要章节缺失" }

func (r *MissingChaptersRule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, fmt.Errorf("failed to get full content: %w", err)
	}

	requiredChapters, _ := settings.Threshold["required_chapters"].([]map[string]any)
	var evidence []rules.Evidence
	var missingCount int

	for _, chapter := range requiredChapters {
		name, _ := chapter["name"].(string)
		synonyms, _ := chapter["synonyms"].([]string)

		found := false
		patterns := append([]string{name}, synonyms...)

		for _, p := range patterns {
			if hasChapter(content, p) {
				found = true
				break
			}
		}

		if !found {
			missingCount++
			evidence = append(evidence, rules.Evidence{
				Section: "目录结构",
				Quote:   fmt.Sprintf("未找到章节: %s", name),
				Reason:  fmt.Sprintf("论文中缺少必要的章节: %s (或其同义词)", name),
			})
		}
	}

	score := float64(missingCount) / float64(len(requiredChapters))
	level := "low"
	if missingCount > 0 {
		level = "med"
		if missingCount > 2 || score > 0.5 {
			level = "high"
		}
	}

	notes := "所有必要章节均已找到。"
	if missingCount > 0 {
		notes = "请务必检查论文结构，补充缺失的核心章节。若章节标题不标准，请参考规范命名。"
	}

	return &rules.CheckResult{
		MetricID: r.ID(),
		Score:    score,
		Level:    level,
		Evidence: evidence,
		Notes:    notes,
	}, nil
}

func hasChapter(content string, pattern string) bool {

	// Basic regex to find LaTeX sectioning commands
	// Handles \chapter{...}, \section{...}, \section*{...} etc.
	headerRegex := `\\(chapter|section|subsection|subsubsection)\*?\{.*` + regexp.QuoteMeta(pattern) + `.*\}`
	re := regexp.MustCompile("(?i)" + headerRegex) // Case-insensitive
	return re.MatchString(content)
}
