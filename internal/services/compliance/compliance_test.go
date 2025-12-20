package compliance

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"paperdebugger/internal/services/compliance/rules/l0"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestL0_01_TotalWordCount(t *testing.T) {
	rule := &l0.TotalWordCountRule{}

	ctx := context.Background()

	// Mock project with some content
	doc := &models.Project{
		RootDocID: "root",
		Docs: []models.ProjectDoc{
			{
				ID:       "root",
				Filepath: "main.tex",
				Lines:    []string{"This is a test document with exactly eight words."},
			},
		},
	}

	t.Run("Below Minimum", func(t *testing.T) {
		settings := rules.IndicatorSettings{
			Enabled:   true,
			Threshold: map[string]any{"min_words": 10},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "high", result.Level)
		assert.True(t, result.Score > 0)
		assert.Contains(t, result.Evidence[0].Reason, "低于学校最低要求")
	})

	t.Run("Within Range", func(t *testing.T) {
		settings := rules.IndicatorSettings{
			Enabled:   true,
			Threshold: map[string]any{"min_words": 5, "max_words": 20},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "low", result.Level)
		assert.Equal(t, float64(0), result.Score)
	})

	t.Run("Above Maximum", func(t *testing.T) {
		settings := rules.IndicatorSettings{
			Enabled:   true,
			Threshold: map[string]any{"min_words": 2, "max_words": 5},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "med", result.Level)
		assert.True(t, result.Score > 0)
	})
}

func TestL0_02_ChapterBalance(t *testing.T) {
	rule := &l0.ChapterBalanceRule{}

	ctx := context.Background()

	doc := &models.Project{
		RootDocID: "root",
		Docs: []models.ProjectDoc{
			{
				ID:       "root",
				Filepath: "main.tex",
				Lines: []string{
					"\\section{Introduction}",
					"This is the introduction section. It has some words.",
					"\\section{Methods}",
					"This is the methods section. It is much longer than the introduction because we want to test the balance.",
					"We add more sentences here. One two three four five six seven eight nine ten.",
					"\\section{Conclusion}",
					"Short conclusion.",
				},
			},
		},
	}

	settings := rules.IndicatorSettings{
		Enabled: true,
		Threshold: map[string]any{
			"expected_balance": []map[string]any{
				{"pattern": "Introduction", "min_pct": 0.2, "max_pct": 0.4},
				{"pattern": "Conclusion", "min_pct": 0.1, "max_pct": 0.2},
			},
		},
	}

	result, err := rule.Check(ctx, doc, settings)
	assert.NoError(t, err)
	assert.Len(t, result.Evidence, 2)
	assert.Equal(t, "high", result.Level)
	assert.Equal(t, "Introduction", result.Evidence[0].Section)
	assert.Equal(t, "Conclusion", result.Evidence[1].Section)
}

func TestL0_03_MissingChapters(t *testing.T) {
	rule := &l0.MissingChaptersRule{}

	ctx := context.Background()

	settings := rules.IndicatorSettings{
		Enabled: true,
		Threshold: map[string]any{
			"required_chapters": []map[string]any{
				{"id": "abstract", "name": "摘要", "synonyms": []string{"Abstract"}},
				{"id": "intro", "name": "引言", "synonyms": []string{"Introduction", "绪论"}},
				{"id": "methods", "name": "核心方法", "synonyms": []string{"Methods"}},
			},
		},
	}

	t.Run("All Found", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{
				{
					ID:       "root",
					Filepath: "main.tex",
					Lines: []string{
						"\\section{Abstract}",
						"\\section{Introduction}",
						"\\section{Methods}",
					},
				},
			},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "low", result.Level)
		assert.Equal(t, float64(0), result.Score)
	})

	t.Run("Missing One", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{
				{
					ID:       "root",
					Filepath: "main.tex",
					Lines: []string{
						"\\section{Abstract}",
						"\\section{绪论}",         // Using synonym
						"\\section{Discussion}", // Methods is missing
					},
				},
			},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "med", result.Level)
		assert.Len(t, result.Evidence, 1)
		assert.Contains(t, result.Evidence[0].Quote, "未找到章节: 核心方法")
	})
}

func TestL0_05_KeywordsRule(t *testing.T) {
	rule := &l0.KeywordsRule{}

	ctx := context.Background()
	settings := rules.IndicatorSettings{
		Enabled:   true,
		Threshold: map[string]any{"min_keywords": 3, "max_keywords": 5},
	}

	t.Run("Valid Keywords", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID:    "root",
				Lines: []string{"摘要: ...", "关键词： 深度学习; 目标检测; 机器人"},
			}},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "low", result.Level)
	})

	t.Run("Too Few", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID:    "root",
				Lines: []string{"Keywords: AI, ML"},
			}},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "high", result.Level)
	})
}

func TestL0_06_TOCConsistency(t *testing.T) {
	rule := &l0.TOCConsistencyRule{}

	ctx := context.Background()

	t.Run("Hierarchy Jump", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID: "root",
				Lines: []string{
					"\\section{Intro}",
					"\\subsubsection{Deep Sub}", // Jumps from 2 to 4
				},
			}},
		}
		result, err := rule.Check(ctx, doc, rules.IndicatorSettings{Enabled: true})
		assert.NoError(t, err)
		assert.Equal(t, "med", result.Level)
		assert.Contains(t, result.Evidence[0].Reason, "级别跳跃")
	})
}

func TestL0_07_08_FiguresTables(t *testing.T) {
	ctx := context.Background()

	t.Run("Figures Count and Citation", func(t *testing.T) {
		countRule := &l0.FiguresTablesCountRule{}
		citeRule := &l0.FiguresTablesCitationRule{}

		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID: "root",
				Lines: []string{
					"\\begin{figure}",
					"\\label{fig:test}",
					"\\end{figure}",
					"Text without citing it.",
				},
			}},
		}

		// L0-07
		countResult, _ := countRule.Check(ctx, doc, rules.IndicatorSettings{
			Enabled:   true,
			Threshold: map[string]any{"min_figures": 2, "min_tables": 0},
		})
		assert.Equal(t, "med", countResult.Level)

		// L0-08
		citeResult, _ := citeRule.Check(ctx, doc, rules.IndicatorSettings{Enabled: true})
		assert.Equal(t, "med", citeResult.Level)
		assert.Contains(t, citeResult.Evidence[0].Reason, "未被引用")
	})
}
func TestL0_04_AbstractRule(t *testing.T) {
	rule := &l0.AbstractRule{}

	ctx := context.Background()
	settings := rules.IndicatorSettings{
		Enabled: true,
		Threshold: map[string]any{
			"min_paragraphs":    1,
			"max_paragraphs":    3,
			"required_keywords": []string{"目的", "方法"},
		},
	}

	t.Run("Valid Abstract", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID: "root",
				Lines: []string{
					"\\section{摘要}",
					"本文研究目的是为了测试代码。我们采用了单元测试的方法。",
				},
			}},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "low", result.Level)
	})

	t.Run("Missing Keywords", func(t *testing.T) {
		doc := &models.Project{
			RootDocID: "root",
			Docs: []models.ProjectDoc{{
				ID: "root",
				Lines: []string{
					"\\section{Abstract}",
					"Just some text without elements.",
				},
			}},
		}
		result, err := rule.Check(ctx, doc, settings)
		assert.NoError(t, err)
		assert.Equal(t, "med", result.Level)
		assert.NotEmpty(t, result.Evidence)
	})
}
