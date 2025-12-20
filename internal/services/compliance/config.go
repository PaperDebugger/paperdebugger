package compliance

import "paperdebugger/internal/services/compliance/rules"

// ComplianceConfig represents the thresholds and rules for a specific metadata combination.
type ComplianceConfig struct {
	School  string `json:"school"`
	Major   string `json:"major"`
	Program string `json:"program"` // Degree program, e.g., MasterCSTrack

	Indicators map[string]rules.IndicatorSettings `json:"indicators"`
}

// Global Registry or helper to fetch config
func GetConfig(school, major, program string) *ComplianceConfig {
	// TODO: Load from DB or static JSON
	return &ComplianceConfig{
		School:  school,
		Major:   major,
		Program: program,
		Indicators: map[string]rules.IndicatorSettings{
			"L0-01": {Enabled: true, Threshold: map[string]any{"min_words": 10000, "max_words": 30000}},
			"L0-02": {Enabled: true, Threshold: map[string]any{
				"expected_balance": []map[string]any{
					{"pattern": "引言|绪论|Introduction", "min_pct": 0.1, "max_pct": 0.2},
					{"pattern": "摘要|Abstract", "min_pct": 0.02, "max_pct": 0.05},
					{"pattern": "结论|Conclusion", "min_pct": 0.05, "max_pct": 0.1},
				},
			}},
			"L0-03": {Enabled: true, Threshold: map[string]any{
				"required_chapters": []map[string]any{
					{"id": "abstract", "name": "摘要", "synonyms": []string{"Abstract", "提要"}},
					{"id": "intro", "name": "引言", "synonyms": []string{"绪论", "Introduction", "前言"}},
					{"id": "methods", "name": "核心方法", "synonyms": []string{"研究方法", "Methods", "Experimental", "实验数据"}},
					{"id": "conclusion", "name": "结论", "synonyms": []string{"Conclusion", "总结与展望"}},
				},
			}},
			"L0-04": {Enabled: true, Threshold: map[string]any{
				"min_paragraphs":    1,
				"max_paragraphs":    3,
				"required_keywords": []string{"目的", "方法", "结果", "结论"},
			}},
			"L0-05": {Enabled: true, Threshold: map[string]any{
				"min_keywords": 3,
				"max_keywords": 8,
			}},
			"L0-06": {Enabled: true, Threshold: map[string]any{
				"similarity_threshold": 0.8,
			}},
			"L0-07": {Enabled: true, Threshold: map[string]any{
				"min_figures": 3,
				"min_tables":  1,
			}},
			"L0-08": {Enabled: true},
			"L0-09": {Enabled: true, Threshold: map[string]any{
				"min_refs": 30,
				"max_refs": 100,
			}},
			"L0-10": {Enabled: true},
			"L0-11": {Enabled: true, Threshold: map[string]any{
				"max_age_years":  10,
				"min_recent_pct": 0.3,
			}},
			"L0-12": {Enabled: true, Threshold: map[string]any{
				"max_self_cite_pct": 0.2,
			}},
			"L0-13": {Enabled: true},
			"L0-14": {Enabled: true},
			"L0-15": {Enabled: true, Threshold: map[string]any{
				"similarity_threshold": 0.8,
			}},
			"L0-16": {Enabled: true},
			"L0-17": {Enabled: true},
			"L0-18": {Enabled: true},
			"L0-19": {Enabled: true},
			"L0-20": {Enabled: true},
		},
	}
}
