package rules

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/models"
	"strings"
)

//go:embed base.tmpl
var basePrompt string

// AIRunner defines the interface for executing AI completions.
type AIRunner interface {
	RunAI(ctx context.Context, systemPrompt, userPrompt string) (string, error)
}

// BaseAIRule provides common functionality for AI-driven rules.
type BaseAIRule struct {
	Runner AIRunner
}

// CheckWithAI is a helper to run an AI check using a template and paper context.
func (r *BaseAIRule) CheckWithAI(ctx context.Context, doc *models.Project, metricID string, systemPrompt string, userPrompt string) (*CheckResult, error) {
	if r.Runner == nil {
		return nil, fmt.Errorf("AI runner not initialized for rule %s", metricID)
	}

	resp, err := r.Runner.RunAI(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI execution failed: %w", err)
	}

	// AI is expected to return a JSON matching the CheckResult structure (or a subset)
	// We extract the JSON block if it's wrapped in markdown
	jsonStr := ExtractJSON(resp)

	var result CheckResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		// If unmarshal fails, we might have a raw string or bad JSON.
		// Fallback to a manual result or return error.
		return nil, fmt.Errorf("failed to parse AI response as JSON: %w, response: %s", err, resp)
	}

	// Ensure the metric ID is correct
	result.MetricID = metricID
	return &result, nil
}

func ExtractJSON(s string) string {

	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start != -1 && end != -1 && end > start {
		return s[start : end+1]
	}
	return s
}
