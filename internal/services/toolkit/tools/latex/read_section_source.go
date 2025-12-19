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

var ReadSectionSourceToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "read_section_source",
			Description: param.NewOpt("Reads the complete LaTeX source code of a specific section by its title."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]any{
						"type":        "string",
						"description": "The title of the section to read (e.g., 'Introduction', 'Methodology').",
					},
				},
				"required": []string{"title"},
			},
		},
	},
}

type ReadSectionSourceArgs struct {
	Title string `json:"title"`
}

type ReadSectionSourceTool struct {
	projectService *services.ProjectService
}

func NewReadSectionSourceTool(projectService *services.ProjectService) *ReadSectionSourceTool {
	return &ReadSectionSourceTool{
		projectService: projectService,
	}
}

func (t *ReadSectionSourceTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSectionSourceArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

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

	// Parse sections to find the requested one
	sections := parseLaTeXSections(fullContent)
	lines := strings.Split(fullContent, "\n")

	// Find the section with matching title (fuzzy match)
	searchTitle := strings.ToLower(strings.TrimSpace(getArgs.Title))
	var targetSection *sectionEntry
	var targetIndex int

	for i, sec := range sections {
		sectionTitle := strings.ToLower(sec.Title)
		if sectionTitle == searchTitle || strings.Contains(sectionTitle, searchTitle) || strings.Contains(searchTitle, sectionTitle) {
			targetSection = &sections[i]
			targetIndex = i
			break
		}
	}

	if targetSection == nil {
		// List available sections as a hint
		var availableTitles []string
		for _, sec := range sections {
			availableTitles = append(availableTitles, sec.Title)
		}
		return fmt.Sprintf("Section '%s' not found. Available sections: %s", getArgs.Title, strings.Join(availableTitles, ", ")), "", nil
	}

	// Determine the end of this section (start of next same-or-higher level section or end of document)
	startLine := targetSection.LineNumber - 1 // 0-indexed
	endLine := len(lines)

	for i := targetIndex + 1; i < len(sections); i++ {
		if sections[i].Level <= targetSection.Level {
			endLine = sections[i].LineNumber - 1 // End before the next section
			break
		}
	}

	// Extract the section content
	if startLine >= len(lines) {
		startLine = len(lines) - 1
	}
	if endLine > len(lines) {
		endLine = len(lines)
	}

	sectionLines := lines[startLine:endLine]

	var result strings.Builder
	result.WriteString(fmt.Sprintf("Section: %s (lines %d-%d)\n\n", targetSection.Title, startLine+1, endLine))
	for i, line := range sectionLines {
		result.WriteString(fmt.Sprintf("%4d: %s\n", startLine+1+i, line))
	}

	return result.String(), "", nil
}

// parseLaTeXSections is defined in document_structure.go

// ReadSectionSourceToolLegacy for backward compatibility (standalone function)
func ReadSectionSourceToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadSectionSourceArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	return fmt.Sprintf(`[WARNING] read_section_source tool not properly initialized. Requested section: '%s'`, getArgs.Title), "", nil
}

// Helper function to re-parse sections (since we can't import from same package)
func parseSectionsForReadSection(content string) []sectionEntry {
	var sections []sectionEntry

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
				title = regexp.MustCompile(`\\[a-zA-Z]+\{([^}]*)\}`).ReplaceAllString(title, "$1")
				title = regexp.MustCompile(`\\[a-zA-Z]+`).ReplaceAllString(title, "")
				title = strings.TrimSpace(title)
				if title != "" {
					sections = append(sections, sectionEntry{
						Level:       p.level,
						Title:       title,
						LineNumber:  lineNum + 1,
						FullContent: line,
					})
				}
				break
			}
		}
	}

	return sections
}
