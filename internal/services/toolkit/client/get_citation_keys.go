package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"regexp"
	"strings"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// GetBibliographyForCitation extracts bibliography content from a project's .bib files.
// It excludes non-essential fields to save tokens when extracting relevant citation keys.
func (a *AIClientV2) GetBibliographyForCitation(ctx context.Context, userId bson.ObjectID, projectId string) (string, error) {
	project, err := a.projectService.GetProject(ctx, userId, projectId)
	if err != nil {
		return "", err
	}

	// Exclude fields that aren't useful for citation matching
	var excludeRe, excludeBraceRe, excludeQuoteRe *regexp.Regexp

	excludeFields := []string{
		"address", "institution", "pages", "eprint", "primaryclass", "volume", "number", "edition", "numpages", "articleno",
		"publisher", "editor", "doi", "url", "acmid", "issn", "archivePrefix", "year", "month", "day",
		"eid", "lastaccessed", "organization", "school", "isbn", "mrclass", "mrnumber", "mrreviewer", "type", "order_no",
		"location", "howpublished", "distincturl", "issue_date", "archived", "series", "source",
	}

	fieldsPattern := strings.Join(excludeFields, "|")
	excludeRe = regexp.MustCompile(`(?i)^\s*(` + fieldsPattern + `)\s*=`)
	excludeBraceRe = regexp.MustCompile(`(?i)^\s*(` + fieldsPattern + `)\s*=\s*\{`)
	excludeQuoteRe = regexp.MustCompile(`(?i)^\s*(` + fieldsPattern + `)\s*=\s*"`)

	var bibLines []string
	for _, doc := range project.Docs {
		if doc.Filepath == "" || !strings.HasSuffix(doc.Filepath, ".bib") {
			continue
		}
		braceDepth := 0
		inQuote := false
		for _, line := range doc.Lines {
			// Handle ongoing multi-line exclusion
			if braceDepth > 0 {
				braceDepth += strings.Count(line, "{") - strings.Count(line, "}")
				continue
			}
			if inQuote {
				if strings.Count(line, `"`)%2 == 1 {
					inQuote = false
				}
				continue
			}
			// Skip comments
			if strings.HasPrefix(strings.TrimSpace(line), "%") {
				continue
			}
			// Skip empty lines
			if strings.TrimSpace(line) == "" {
				continue
			}
			// Skip excluded fields
			if excludeRe != nil && excludeRe.MatchString(line) {
				if excludeBraceRe.MatchString(line) {
					braceDepth = strings.Count(line, "{") - strings.Count(line, "}")
				} else if excludeQuoteRe.MatchString(line) && strings.Count(line, `"`)%2 == 1 {
					inQuote = true
				}
				continue
			}

			bibLines = append(bibLines, line)
		}
	}

	bibliography := strings.Join(bibLines, "\n")

	// Normalize multiple spaces
	multiSpaceRe := regexp.MustCompile(` {2,}`)
	bibliography = multiSpaceRe.ReplaceAllString(bibliography, " ")

	return bibliography, nil
}

func (a *AIClientV2) GetCitationKeys(ctx context.Context, sentence string, userId bson.ObjectID, projectId string, llmProvider *models.LLMProviderConfig) (string, error) {
	bibliography, err := a.GetBibliographyForCitation(ctx, userId, projectId)

	if err != nil {
		return "", err
	}

	// Get citation keys from LLM
	emptyCitation := "none"
	message := fmt.Sprintf("Bibliography: %s\nSentence: %s\nBased on the sentence and bibliography, suggest only the most relevant citation keys separated by commas with no spaces (e.g. key1,key2). Be selective and only include citations that are directly relevant. Avoid suggesting more than 3 citations. If no relevant citations are found, return '%s'.", sentence, bibliography, emptyCitation)

	_, resp, err := a.ChatCompletionV2(ctx, "gpt-5.2", OpenAIChatHistory{
		openai.SystemMessage("You are a helpful assistant that suggests relevant citation keys."),
		openai.UserMessage(message),
	}, llmProvider)

	if err != nil {
		return "", err
	}

	if len(resp) == 0 {
		return "", nil
	}

	citationKeys := strings.TrimSpace(resp[0].Payload.GetAssistant().GetContent())

	if citationKeys == emptyCitation {
		return "", nil
	}

	return citationKeys, nil
}
