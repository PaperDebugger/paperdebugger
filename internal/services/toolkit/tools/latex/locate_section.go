package latex

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var LocateSectionToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "locate_section",
			Description: param.NewOpt("Locates a specific section or manuscript region by title and returns the file path and line number range. Also supports special targets like Title and Abstract."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]any{
						"type":        "string",
						"description": "The title of the section to locate (e.g., 'Introduction', 'Related Work', 'Abstract', or 'Title').",
					},
				},
				"required": []string{"title"},
			},
		},
	},
}

type LocateSectionArgs struct {
	Title string `json:"title"`
}

type LocateSectionTool struct {
	projectService *services.ProjectService
}

type locatedSection struct {
	Found        bool   `json:"found"`
	Title        string `json:"title"`
	FilePath     string `json:"file_path,omitempty"`
	StartLine    int    `json:"start_line,omitempty"`
	EndLine      int    `json:"end_line,omitempty"`
	MatchedTitle string `json:"matched_title,omitempty"`
	Kind         string `json:"kind,omitempty"`
	Message      string `json:"message,omitempty"`
}

type sectionMatch struct {
	level    int
	title    string
	filePath string
	line     int
}

var (
	titleCommandPattern   = regexp.MustCompile(`\\title(?:\[[^\]]*\])?\{`)
	abstractStartPattern  = regexp.MustCompile(`\\begin\{abstract\}`)
	abstractEndPattern    = regexp.MustCompile(`\\end\{abstract\}`)
	sectionHeaderPatterns = []struct {
		level   int
		pattern *regexp.Regexp
	}{
		{0, regexp.MustCompile(`^[^%]*\\part\*?\{([^}]*)\}`)},
		{1, regexp.MustCompile(`^[^%]*\\chapter\*?\{([^}]*)\}`)},
		{2, regexp.MustCompile(`^[^%]*\\section\*?\{([^}]*)\}`)},
		{3, regexp.MustCompile(`^[^%]*\\subsection\*?\{([^}]*)\}`)},
		{4, regexp.MustCompile(`^[^%]*\\subsubsection\*?\{([^}]*)\}`)},
	}
	nonAlphanumericPattern = regexp.MustCompile(`[^a-z0-9]+`)
)

func NewLocateSectionTool(projectService *services.ProjectService) *LocateSectionTool {
	return &LocateSectionTool{
		projectService: projectService,
	}
}

func (t *LocateSectionTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs LocateSectionArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	if strings.TrimSpace(getArgs.Title) == "" {
		result, _ := json.Marshal(locatedSection{
			Found:   false,
			Title:   "",
			Message: "title is required",
		})
		return string(result), "", nil
	}

	actor, projectID, _ := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectID == "" {
		return "", "", fmt.Errorf("failed to get actor or project id from context")
	}

	project, err := t.projectService.GetProject(ctx, actor.ID, projectID)
	if err != nil {
		return "", "", fmt.Errorf("failed to get project: %w", err)
	}

	result := locateSectionInProject(project, getArgs.Title)
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return "", "", err
	}
	return string(resultJSON), "", nil
}

func locateSectionInProject(project *models.Project, query string) locatedSection {
	normalizedQuery := normalizeSectionLookup(query)
	if normalizedQuery == "" {
		return locatedSection{
			Found:   false,
			Title:   query,
			Message: "empty section query",
		}
	}

	if match, ok := findSpecialSectionLocation(project, normalizedQuery); ok {
		return locatedSection{
			Found:        true,
			Title:        query,
			FilePath:     match.filePath,
			StartLine:    match.startLine,
			EndLine:      match.endLine,
			MatchedTitle: match.matchedTitle,
			Kind:         match.kind,
		}
	}

	entriesByFile := collectProjectSectionMatches(project)
	for filePath, entries := range entriesByFile {
		for idx, entry := range entries {
			normalizedTitle := normalizeSectionLookup(entry.title)
			if normalizedTitle != normalizedQuery {
				continue
			}

			endLine := len(findDocLines(project, filePath))
			for nextIdx := idx + 1; nextIdx < len(entries); nextIdx++ {
				if entries[nextIdx].level <= entry.level {
					endLine = entries[nextIdx].line - 1
					break
				}
			}

			if endLine < entry.line {
				endLine = entry.line
			}

			return locatedSection{
				Found:        true,
				Title:        query,
				FilePath:     filePath,
				StartLine:    entry.line,
				EndLine:      endLine,
				MatchedTitle: entry.title,
				Kind:         "section",
			}
		}
	}

	return locatedSection{
		Found:   false,
		Title:   query,
		Message: fmt.Sprintf("could not locate section '%s'", query),
	}
}

func collectProjectSectionMatches(project *models.Project) map[string][]sectionMatch {
	entriesByFile := make(map[string][]sectionMatch)
	for _, doc := range project.Docs {
		for lineIdx, line := range doc.Lines {
			for _, sectionPattern := range sectionHeaderPatterns {
				matches := sectionPattern.pattern.FindStringSubmatch(line)
				if len(matches) < 2 {
					continue
				}
				title := cleanLaTeXTitle(strings.TrimSpace(matches[1]))
				if title == "" {
					continue
				}
				entriesByFile[doc.Filepath] = append(entriesByFile[doc.Filepath], sectionMatch{
					level:    sectionPattern.level,
					title:    title,
					filePath: doc.Filepath,
					line:     lineIdx + 1,
				})
				break
			}
		}
	}
	return entriesByFile
}

type specialSectionLocation struct {
	filePath     string
	startLine    int
	endLine      int
	matchedTitle string
	kind         string
}

func findSpecialSectionLocation(project *models.Project, normalizedQuery string) (specialSectionLocation, bool) {
	docs := orderedProjectDocs(project)

	switch normalizedQuery {
	case "title":
		for _, doc := range docs {
			for idx, line := range doc.Lines {
				if titleCommandPattern.MatchString(strings.TrimSpace(line)) {
					return specialSectionLocation{
						filePath:     doc.Filepath,
						startLine:    idx + 1,
						endLine:      idx + 1,
						matchedTitle: "Title",
						kind:         "title",
					}, true
				}
			}
		}
	case "abstract":
		for _, doc := range docs {
			startLine := -1
			for idx, line := range doc.Lines {
				trimmed := strings.TrimSpace(line)
				if startLine == -1 && abstractStartPattern.MatchString(trimmed) {
					startLine = idx + 1
					continue
				}
				if startLine != -1 && abstractEndPattern.MatchString(trimmed) {
					return specialSectionLocation{
						filePath:     doc.Filepath,
						startLine:    startLine,
						endLine:      idx + 1,
						matchedTitle: "Abstract",
						kind:         "abstract",
					}, true
				}
			}
			if startLine != -1 {
				return specialSectionLocation{
					filePath:     doc.Filepath,
					startLine:    startLine,
					endLine:      len(doc.Lines),
					matchedTitle: "Abstract",
					kind:         "abstract",
				}, true
			}
		}
	}

	return specialSectionLocation{}, false
}

func orderedProjectDocs(project *models.Project) []*models.ProjectDoc {
	ordered := make([]*models.ProjectDoc, 0, len(project.Docs))
	for idx := range project.Docs {
		if project.Docs[idx].ID == project.RootDocID {
			ordered = append(ordered, &project.Docs[idx])
			break
		}
	}
	for idx := range project.Docs {
		if project.Docs[idx].ID == project.RootDocID {
			continue
		}
		ordered = append(ordered, &project.Docs[idx])
	}
	return ordered
}

func findDocLines(project *models.Project, filePath string) []string {
	for _, doc := range project.Docs {
		if doc.Filepath == filePath {
			return doc.Lines
		}
	}
	return nil
}

func normalizeSectionLookup(text string) string {
	text = strings.ToLower(strings.TrimSpace(text))
	text = cleanLaTeXTitle(text)
	text = nonAlphanumericPattern.ReplaceAllString(text, " ")
	return strings.Join(strings.Fields(text), " ")
}

// LocateSectionToolLegacy for backward compatibility (standalone function)
func LocateSectionToolLegacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs LocateSectionArgs
	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	result, _ := json.Marshal(locatedSection{
		Found:   false,
		Title:   getArgs.Title,
		Message: "locate_section tool is not properly initialized. Please ensure ProjectService is available.",
	})
	return string(result), "", nil
}
