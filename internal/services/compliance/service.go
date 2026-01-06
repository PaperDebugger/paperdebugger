package compliance

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"paperdebugger/internal/services/compliance/rules/l0"
	"paperdebugger/internal/services/compliance/rules/l1"
	"paperdebugger/internal/services/compliance/rules/l2"
	"text/template"
)

//go:embed rules/report_prompts/overall_assessment.tmpl
var overallAssessmentTmpl string

//go:embed rules/report_prompts/readiness_summary.tmpl
var readinessSummaryTmpl string

//go:embed rules/report_prompts/blocking_issues.tmpl
var blockingIssuesTmpl string

//go:embed rules/report_prompts/important_improvements.tmpl
var importantImprovementsTmpl string

//go:embed rules/report_prompts/optional_refinements.tmpl
var optionalRefinementsTmpl string

//go:embed rules/report_prompts/confidence_forecast.tmpl
var confidenceForecastTmpl string

type ComplianceService struct {
	db     *db.DB
	cfg    *cfg.Cfg
	logger *logger.Logger
	Runner rules.AIRunner
}

func NewComplianceService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger, runner rules.AIRunner) *ComplianceService {
	return &ComplianceService{
		db:     db,
		cfg:    cfg,
		logger: logger,
		Runner: runner,
	}
}

func (s *ComplianceService) Audit(ctx context.Context, project *models.Project, school, major, program string, onProgress func(progress float32)) ([]rules.CheckResult, error) {
	config := GetConfig(school, major, program)

	// Register all rules
	allRules := []rules.IndicatorChecker{
		&l0.TotalWordCountRule{},
		&l0.ChapterBalanceRule{},
		&l0.MissingChaptersRule{},
		&l0.AbstractRule{},
		&l0.KeywordsRule{},
		&l0.TOCConsistencyRule{},
		&l0.FiguresTablesCountRule{},
		&l0.FiguresTablesCitationRule{},
		&l0.CitationCountRule{},
		&l0.CitationAgingRule{},
		&l0.MissingCitationRefRule{},
		&l0.PunctuationRule{},
		&l0.SimilarityRule{},
		&l0.BlockFormatRule{},
		&l0.LayoutRule{},
		&l0.TranslationRule{},
		&l0.AIDetectionRule{},
	}

	// Add L1 Rules
	l1Rules := l1.GetAllL1Rules(s.Runner)
	allRules = append(allRules, l1Rules...)

	// Add L2 Rules
	allRules = append(allRules, &l2.InnovationCheckRule{})

	// Filter enabled rules
	var enabledRules []rules.IndicatorChecker
	for _, checker := range allRules {
		settings, ok := config.Indicators[checker.ID()]
		if ok && settings.Enabled {
			enabledRules = append(enabledRules, checker)
		}
	}

	total := len(enabledRules)
	var results []rules.CheckResult
	for i, checker := range enabledRules {
		settings := config.Indicators[checker.ID()]
		result, err := checker.Check(ctx, project, settings)
		if err != nil {
			s.logger.Error("failed to run compliance check", "metric_id", checker.ID(), "error", err)
		} else if result != nil {
			result.Name = checker.Name()
			results = append(results, *result)
		}

		if onProgress != nil {
			onProgress(float32(i+1) / float32(total))
		}
	}

	return results, nil
}

func (s *ComplianceService) GenerateReport(ctx context.Context, results []rules.CheckResult) (*rules.ComplianceReport, error) {
	if s.Runner == nil {
		return nil, fmt.Errorf("AI runner not initialized")
	}

	// 1. Gather L1 results into a structured string for the AI
	var l1Findings []string
	for _, res := range results {
		if !s.isL1(res.MetricID) {
			continue
		}

		findingsJson, _ := json.Marshal(res)
		l1Findings = append(l1Findings, string(findingsJson))
	}

	if len(l1Findings) == 0 {
		return &rules.ComplianceReport{OverallAssessment: "No significant L1 issues found."}, nil
	}

	aggregatedFindings := fmt.Sprintf("Aggregated L1 findings:\n%s", bytes.Join(func() [][]byte {
		var b [][]byte
		for _, f := range l1Findings {
			b = append(b, []byte(f))
		}
		return b
	}(), []byte("\n")))

	report := &rules.ComplianceReport{}

	// Task helper to run a prompt and unmarshal result
	runPart := func(tmplStr string, target any) error {
		tmpl, err := template.New("part").Parse(tmplStr)
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		if err := tmpl.Execute(&buf, struct{ AggregatedL1Results string }{AggregatedL1Results: aggregatedFindings}); err != nil {
			return err
		}

		resp, err := s.Runner.RunAI(ctx, "You are a professional academic reviewer.", buf.String())
		if err != nil {
			return err
		}

		// If target is a string pointer, just store the response
		if strPtr, ok := target.(*string); ok {
			*strPtr = resp
			return nil
		}

		// Otherwise, parse JSON
		jsonStr := rules.ExtractJSON(resp)
		return json.Unmarshal([]byte(jsonStr), target)
	}

	// Running parts sequentially for stability, could be parallelized
	if err := runPart(overallAssessmentTmpl, &report.OverallAssessment); err != nil {
		s.logger.Error("failed overall assessment", "error", err)
	}
	if err := runPart(readinessSummaryTmpl, &report.AcceptanceReadiness); err != nil {
		s.logger.Error("failed readiness summary", "error", err)
	}
	if err := runPart(blockingIssuesTmpl, &report.BlockingIssues); err != nil {
		s.logger.Error("failed blocking issues", "error", err)
	}
	if err := runPart(importantImprovementsTmpl, &report.ImportantImprovements); err != nil {
		s.logger.Error("failed important improvements", "error", err)
	}
	if err := runPart(optionalRefinementsTmpl, &report.OptionalRefinements); err != nil {
		s.logger.Error("failed optional refinements", "error", err)
	}
	if err := runPart(confidenceForecastTmpl, &report.ConfidenceForecast); err != nil {
		s.logger.Error("failed confidence forecast", "error", err)
	}

	return report, nil
}

func (s *ComplianceService) isL1(id string) bool {
	return len(id) >= 2 && id[:2] == "L1"
}
