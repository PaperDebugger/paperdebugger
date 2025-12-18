package latex

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var GetDocumentStructureToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "get_document_structure",
			Description: param.NewOpt("Gets the complete project document outline (section tree). Returns the complete document outline including all sections, subsections, and their hierarchy."),
			Parameters: openai.FunctionParameters{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
	},
}

type DocumentStructureTool struct {
	projectService *services.ProjectService
}

func NewDocumentStructureTool(projectService *services.ProjectService) *DocumentStructureTool {
	return &DocumentStructureTool{
		projectService: projectService,
	}
}

type sectionEntry struct {
	Level       int // 0=part, 1=chapter, 2=section, 3=subsection, 4=subsubsection
	Title       string
	LineNumber  int
	FilePath    string
	FullContent string // The expanded content line
}

func (t *DocumentStructureTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	// Get project from context
	actor, projectId, _ := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" {
		return "", "", fmt.Errorf("failed to get actor or project id from context")
	}

	project, err := t.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", fmt.Errorf("failed to get project: %w", err)
	}

	// Get the full expanded content
	fullContent, err := project.GetFullContent()
	if err != nil {
		return "", "", fmt.Errorf("failed to get full content: %w", err)
	}

	// Parse the LaTeX to extract sections
	sections := parseLaTeXSections(fullContent)

	if len(sections) == 0 {
		return "No sections found in the document.", "", nil
	}

	// Build a hierarchical output
	var result strings.Builder
	result.WriteString("Document Structure:\n\n")

	for _, sec := range sections {
		indent := strings.Repeat("  ", sec.Level)
		levelName := getLevelName(sec.Level)
		result.WriteString(fmt.Sprintf("%s%s: %s (line %d)\n", indent, levelName, sec.Title, sec.LineNumber))
	}

	return result.String(), "", nil
}

// parseLaTeXSections extracts section information from LaTeX content
func parseLaTeXSections(content string) []sectionEntry {
	var sections []sectionEntry

	// Regex patterns for different section levels
	patterns := []struct {
		level   int
		pattern *regexp.Regexp
	}{
		{0, regexp.MustCompile(`(?m)^[^%]*\\part\*?\{([^}]*)\}`)},
		{1, regexp.MustCompile(`(?m)^[^%]*\\chapter\*?\{([^}]*)\}`)},
		{2, regexp.MustCompile(`(?m)^[^%]*\\section\*?\{([^}]*)\}`)},
		{3, regexp.MustCompile(`(?m)^[^%]*\\subsection\*?\{([^}]*)\}`)},
		{4, regexp.MustCompile(`(?m)^[^%]*\\subsubsection\*?\{([^}]*)\}`)},
	}

	lines := strings.Split(content, "\n")

	for lineNum, line := range lines {
		for _, p := range patterns {
			matches := p.pattern.FindStringSubmatch(line)
			if matches != nil && len(matches) > 1 {
				title := strings.TrimSpace(matches[1])
				// Clean up the title (remove LaTeX commands within)
				title = cleanLaTeXTitle(title)
				if title != "" {
					sections = append(sections, sectionEntry{
						Level:       p.level,
						Title:       title,
						LineNumber:  lineNum + 1, // 1-indexed
						FullContent: line,
					})
				}
				break // Only match one pattern per line
			}
		}
	}

	return sections
}

// cleanLaTeXTitle removes or simplifies LaTeX commands in titles
func cleanLaTeXTitle(title string) string {
	// Remove common LaTeX commands
	title = regexp.MustCompile(`\\[a-zA-Z]+\{([^}]*)\}`).ReplaceAllString(title, "$1")
	title = regexp.MustCompile(`\\[a-zA-Z]+`).ReplaceAllString(title, "")
	title = strings.TrimSpace(title)
	return title
}

// getLevelName returns a human-readable name for the section level
func getLevelName(level int) string {
	switch level {
	case 0:
		return "Part"
	case 1:
		return "Chapter"
	case 2:
		return "Section"
	case 3:
		return "Subsection"
	case 4:
		return "Subsubsection"
	default:
		return "Section"
	}
}

// GetDocumentStructureTool for backward compatibility (standalone function)
func GetDocumentStructureTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	return `[WARNING] get_document_structure tool not properly initialized. Please ensure ProjectService is available.`, "", nil
}
