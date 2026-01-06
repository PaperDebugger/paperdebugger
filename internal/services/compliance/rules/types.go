package rules

import (
	"context"
	"paperdebugger/internal/models"
)

type Evidence struct {
	Section string `json:"section"`
	Quote   string `json:"quote"`
	Reason  string `json:"reason"`
}

type CheckResult struct {
	MetricID string     `json:"metric_id"`
	Name     string     `json:"name"`
	Score    float64    `json:"score"`
	Level    string     `json:"level"` // "low" | "med" | "high"
	Evidence []Evidence `json:"evidence"`
	Notes    string     `json:"notes"` // General notes

	// L1 Specific Structured Output
	Analysis    string               `json:"analysis,omitempty"`
	Suggestions *RevisionSuggestions `json:"suggestions,omitempty"`
	Impact      *ReviewerImpact      `json:"impact,omitempty"`
}

type RevisionSuggestions struct {
	PartA string `json:"part_a"` // Major / Structural
	PartB string `json:"part_b"` // Minor / Text-level
}

type ReviewerImpact struct {
	Severity           string   `json:"severity"` // Critical / Major / Minor
	AffectedDimensions []string `json:"affected_dimensions"`
}

// ComplianceReport represents the aggregated final report.
type ComplianceReport struct {
	OverallAssessment     string                 `json:"overall_assessment"`
	AcceptanceReadiness   AcceptanceReadiness    `json:"acceptance_readiness"`
	BlockingIssues        []BlockingIssue        `json:"blocking_issues"`
	ImportantImprovements []ImportantImprovement `json:"important_improvements"`
	OptionalRefinements   []OptionalRefinement   `json:"optional_refinements"`
	ConfidenceForecast    ConfidenceForecast     `json:"confidence_forecast"`
}

type AcceptanceReadiness struct {
	Summary           string   `json:"summary"`
	RevisionEffort    string   `json:"revision_effort"` // Light / Major / Rework
	WeakestDimensions []string `json:"weakest_dimensions"`
}

type BlockingIssue struct {
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	WhyBlocking      string       `json:"why_blocking"`
	AffectedSections []string     `json:"affected_sections"`
	ActionPlan       []ActionItem `json:"action_plan"`
}

type ImportantImprovement struct {
	Title         string       `json:"title"`
	Description   string       `json:"description"`
	WeakensAspect string       `json:"weakens_aspect"`
	ActionPlan    []ActionItem `json:"action_plan"`
}

type OptionalRefinement struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type ActionItem struct {
	Action          string `json:"action"`
	AffectedSection string `json:"affected_section"`
}

type ConfidenceForecast struct {
	ChangeSummary     string `json:"change_summary"`
	RemainingConcerns string `json:"remaining_concerns"`
	OutcomeProjection string `json:"outcome_projection"`
}

type IndicatorSettings struct {
	Enabled   bool           `json:"enabled"`
	Threshold map[string]any `json:"threshold"` // e.g., "min_words": 10000
}

// IndicatorChecker defines the interface for each compliance rule.
type IndicatorChecker interface {
	ID() string
	Name() string
	Check(ctx context.Context, doc *models.Project, settings IndicatorSettings) (*CheckResult, error)
}
