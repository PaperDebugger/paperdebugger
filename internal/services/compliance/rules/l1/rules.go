package l1

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/compliance/rules"
	"text/template"
)

//go:embed base_l1.tmpl
var baseL1Prompt string

//go:embed prompts/l1-01-question.tmpl
var p01 string

//go:embed prompts/l1-02-objectives.tmpl
var p02 string

//go:embed prompts/l1-03-motivation.tmpl
var p03 string

//go:embed prompts/l1-04-contributions.tmpl
var p04 string

//go:embed prompts/l1-05-novelty.tmpl
var p05 string

//go:embed prompts/l1-06-alignment-obj-method.tmpl
var p06 string

//go:embed prompts/l1-07-claims-support.tmpl
var p07 string

//go:embed prompts/l1-08-exp-alignment.tmpl
var p08 string

//go:embed prompts/l1-09-metrics.tmpl
var p09 string

//go:embed prompts/l1-10-baselines.tmpl
var p10 string

//go:embed prompts/l1-11-assumptions.tmpl
var p11 string

//go:embed prompts/l1-12-applicability.tmpl
var p12 string

//go:embed prompts/l1-13-formulation.tmpl
var p13 string

//go:embed prompts/l1-14-design.tmpl
var p14 string

//go:embed prompts/l1-15-overstated.tmpl
var p15 string

//go:embed prompts/l1-16-ablation.tmpl
var p16 string

//go:embed prompts/l1-17-reproducibility.tmpl
var p17 string

//go:embed prompts/l1-18-missing-limitation.tmpl
var p18 string

//go:embed prompts/l1-19-conclusion-not-supported.tmpl
var p19 string

//go:embed prompts/l1-20-e2e-logical-coherence.tmpl
var p20 string

type L1Rule struct {
	rules.BaseAIRule
	IDVal   string
	NameVal string
	Prompt  string
}

func (r *L1Rule) ID() string   { return r.IDVal }
func (r *L1Rule) Name() string { return r.NameVal }

func (r *L1Rule) Check(ctx context.Context, doc *models.Project, settings rules.IndicatorSettings) (*rules.CheckResult, error) {
	content, err := doc.GetFullContent()
	if err != nil {
		return nil, err
	}

	// Render the system prompt from base_l1.tmpl
	tmpl, err := template.New("l1").Parse(baseL1Prompt)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	data := struct {
		MetricID     string
		MetricName   string
		PaperContext string
		Guideline    string
	}{
		MetricID:     r.IDVal,
		MetricName:   r.NameVal,
		PaperContext: content, // For now, pass full content. In future, we might need to truncate or pick sections.
		Guideline:    r.Prompt,
	}

	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}

	systemPrompt := buf.String()
	userPrompt := fmt.Sprintf("Please evaluate the following paper for %s (%s).", r.IDVal, r.NameVal)

	return r.CheckWithAI(ctx, doc, r.IDVal, systemPrompt, userPrompt)
}

func GetAllL1Rules(runner rules.AIRunner) []rules.IndicatorChecker {
	base := rules.BaseAIRule{Runner: runner}
	return []rules.IndicatorChecker{
		&L1Rule{BaseAIRule: base, IDVal: "L1-01", NameVal: "Research Question Unclear", Prompt: p01},
		&L1Rule{BaseAIRule: base, IDVal: "L1-02", NameVal: "Research Objectives Vague", Prompt: p02},
		&L1Rule{BaseAIRule: base, IDVal: "L1-03", NameVal: "Weak Research Motivation", Prompt: p03},
		&L1Rule{BaseAIRule: base, IDVal: "L1-04", NameVal: "Contributions Not Clearly Stated", Prompt: p04},
		&L1Rule{BaseAIRule: base, IDVal: "L1-05", NameVal: "Contributions Poorly Differentiated", Prompt: p05},
		&L1Rule{BaseAIRule: base, IDVal: "L1-06", NameVal: "Objective-Method Misalignment", Prompt: p06},
		&L1Rule{BaseAIRule: base, IDVal: "L1-07", NameVal: "Claims Not Supported by Methods", Prompt: p07},
		&L1Rule{BaseAIRule: base, IDVal: "L1-08", NameVal: "Experiments Not Aligned with Questions", Prompt: p08},
		&L1Rule{BaseAIRule: base, IDVal: "L1-09", NameVal: "Inappropriate Evaluation Metrics", Prompt: p09},
		&L1Rule{BaseAIRule: base, IDVal: "L1-10", NameVal: "Insufficient Baselines", Prompt: p10},
		&L1Rule{BaseAIRule: base, IDVal: "L1-11", NameVal: "Unstated Assumptions", Prompt: p11},
		&L1Rule{BaseAIRule: base, IDVal: "L1-12", NameVal: "Unclear Scope of Applicability", Prompt: p12},
		&L1Rule{BaseAIRule: base, IDVal: "L1-13", NameVal: "Problem Formulation Issues", Prompt: p13},
		&L1Rule{BaseAIRule: base, IDVal: "L1-14", NameVal: "Design Choices Not Justified", Prompt: p14},
		&L1Rule{BaseAIRule: base, IDVal: "L1-15", NameVal: "Result Interpretation Overstated", Prompt: p15},
		&L1Rule{BaseAIRule: base, IDVal: "L1-16", NameVal: "Inadequate Ablation Studies", Prompt: p16},
		&L1Rule{BaseAIRule: base, IDVal: "L1-17", NameVal: "Reproducibility Risks", Prompt: p17},
		&L1Rule{BaseAIRule: base, IDVal: "L1-18", NameVal: "Missing Limitations Discussion", Prompt: p18},
		&L1Rule{BaseAIRule: base, IDVal: "L1-19", NameVal: "Conclusions Not Supported", Prompt: p19},
		&L1Rule{BaseAIRule: base, IDVal: "L1-20", NameVal: "End-to-End Logical Coherence", Prompt: p20},
	}
}
