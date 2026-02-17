package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/tools/xtramcp"
	"regexp"
	"strings"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

var (
	// Regex patterns compiled once
	titleFieldRe  = regexp.MustCompile(`(?i)title\s*=\s*`)     // matches "title = " prefix
	entryStartRe  = regexp.MustCompile(`(?i)^\s*@(\w+)\s*\{`)  // eg. @article{
	stringEntryRe = regexp.MustCompile(`(?i)^\s*@String\s*\{`) // eg. @String{
	multiSpaceRe  = regexp.MustCompile(` {2,}`)

	// Fields to exclude from bibliography (not useful for citation matching)
	excludedFields = []string{
		"address", "institution", "pages", "eprint", "primaryclass", "volume", "number",
		"edition", "numpages", "articleno", "publisher", "editor", "doi", "url", "acmid",
		"issn", "archivePrefix", "year", "month", "day", "eid", "lastaccessed", "organization",
		"school", "isbn", "mrclass", "mrnumber", "mrreviewer", "type", "order_no", "location",
		"howpublished", "distincturl", "issue_date", "archived", "series", "source",
	}
	excludeFieldRe = regexp.MustCompile(`(?i)^\s*(` + strings.Join(excludedFields, "|") + `)\s*=`)
)

// braceBalance returns the net brace count (opens - closes) in a string.
func braceBalance(s string) int {
	return strings.Count(s, "{") - strings.Count(s, "}")
}

// isQuoteUnclosed returns true if the string has an odd number of double quotes.
func isQuoteUnclosed(s string) bool {
	return strings.Count(s, `"`)%2 == 1
}

// extractBalancedValue extracts a BibTeX field value (braced or quoted) starting at pos.
// It is needed for (1) getting full title (for abstract lookup) and (2) skipping excluded
// fields that may span multiple lines.
// Returns the extracted content and end position, or empty string and -1 if not found.
func extractBalancedValue(s string, pos int) (string, int) {
	// Skip whitespace
	for pos < len(s) && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\n' || s[pos] == '\r') {
		pos++
	}
	if pos >= len(s) {
		return "", -1
	}

	switch s[pos] {
	case '{':
		depth := 0
		start := pos + 1
		for i := pos; i < len(s); i++ {
			switch s[i] {
			case '{':
				depth++
			case '}':
				depth--
				if depth == 0 {
					return s[start:i], i + 1
				}
			}
		}
	case '"':
		start := pos + 1
		for i := start; i < len(s); i++ {
			if s[i] == '"' {
				return s[start:i], i + 1
			}
		}
	}
	return "", -1
}

// extractTitle extracts the title from a BibTeX entry string.
// It handles nested braces like title = {A Study of {COVID-19}}.
func extractTitle(entry string) string {
	loc := titleFieldRe.FindStringIndex(entry)
	if loc == nil {
		return ""
	}
	content, _ := extractBalancedValue(entry, loc[1])
	return strings.TrimSpace(content)
}

// parseBibFile extracts bibliography entries from a .bib file's lines,
// filtering out @String macros, comments, and excluded fields (url, doi, etc.).
func parseBibFile(lines []string) []string {
	var entries []string
	var currentEntry []string

	// It handles multi-line field values by tracking brace/quote balance:
	//   - skipBraces > 0: currently skipping a {bracketed} value, wait until balanced
	//   - skipQuotes = true: currently skipping a "quoted" value, wait for closing quote

	var entryDepth int  // brace depth for current entry (0 = entry complete)
	var skipBraces int  // > 0 means we're skipping lines until braces balance
	var skipQuotes bool // true means we're skipping lines until closing quote

	for _, line := range lines {
		// Skip empty lines and comments
		if trimmed := strings.TrimSpace(line); trimmed == "" || strings.HasPrefix(trimmed, "%") {
			continue
		}

		// If skipping a multi-line {bracketed} field value, keep skipping until balanced
		if skipBraces > 0 {
			skipBraces += braceBalance(line)
			continue
		}

		// If skipping a multi-line "quoted" field value, keep skipping until closing quote
		if skipQuotes {
			if isQuoteUnclosed(line) { // odd quote count = found closing quote
				skipQuotes = false
			}
			continue
		}

		// Skip @String{...} macro definitions
		if stringEntryRe.MatchString(line) {
			skipBraces = braceBalance(line)
			continue
		}

		// Skip excluded fields (url, doi, pages, etc.) - may span multiple lines
		if excludeFieldRe.MatchString(line) {
			if strings.Contains(line, "={") || strings.Contains(line, "= {") {
				skipBraces = braceBalance(line)
			} else if strings.Contains(line, `="`) || strings.Contains(line, `= "`) {
				skipQuotes = isQuoteUnclosed(line)
			}
			continue
		}

		// Start of new entry: @article{key, or @book{key, etc.
		if entryStartRe.MatchString(line) {
			if len(currentEntry) > 0 {
				entries = append(entries, strings.Join(currentEntry, "\n"))
			}
			currentEntry = []string{line}
			entryDepth = braceBalance(line)
			continue
		}

		// Continue building current entry
		if len(currentEntry) > 0 {
			currentEntry = append(currentEntry, line)
			entryDepth += braceBalance(line)
			if entryDepth <= 0 { // entry complete when braces balance
				entries = append(entries, strings.Join(currentEntry, "\n"))
				currentEntry = nil
			}
		}
	}

	// Last entry if file doesn't end with balanced braces
	if len(currentEntry) > 0 {
		entries = append(entries, strings.Join(currentEntry, "\n"))
	}
	return entries
}

// fetchAbstracts enriches entries with abstracts from XtraMCP using batch API.
func (a *AIClientV2) fetchAbstracts(ctx context.Context, entries []string) []string {
	// Extract titles
	var titles []string
	for _, entry := range entries {
		if title := extractTitle(entry); title != "" {
			titles = append(titles, title)
		}
	}

	// Fetch abstracts and build lookup map
	abstracts := make(map[string]string)
	svc := xtramcp.NewXtraMCPServices(a.cfg.XtraMCPURI)
	resp, err := svc.GetPaperAbstracts(ctx, titles)
	if err == nil && resp.Success {
		for _, r := range resp.Results {
			if r.Found {
				abstracts[r.Title] = r.Abstract
			}
		}
	}

	// Enrich entries
	result := make([]string, len(entries))
	for i, entry := range entries {
		if abstract, ok := abstracts[extractTitle(entry)]; ok && abstract != "" {
			if pos := strings.LastIndex(entry, "}"); pos > 0 {
				result[i] = entry[:pos] + fmt.Sprintf(",\n abstract = {%s}\n}", abstract)
				continue
			}
		}
		result[i] = entry
	}
	return result
}

// GetBibliographyForCitation extracts bibliography content from a project's .bib files.
// It excludes non-essential fields to save tokens and fetches abstracts from XtraMCP.
func (a *AIClientV2) GetBibliographyForCitation(ctx context.Context, userId bson.ObjectID, projectId string) (string, error) {
	project, err := a.projectService.GetProject(ctx, userId, projectId)
	if err != nil {
		return "", err
	}

	// Parse all .bib files
	var entries []string
	for _, doc := range project.Docs {
		if strings.HasSuffix(doc.Filepath, ".bib") {
			entries = append(entries, parseBibFile(doc.Lines)...)
		}
	}

	// Enrich with abstracts
	entries = a.fetchAbstracts(ctx, entries)

	// Join and normalize
	bibliography := strings.Join(entries, "\n")
	return multiSpaceRe.ReplaceAllString(bibliography, " "), nil
}

func (a *AIClientV2) GetCitationKeys(ctx context.Context, sentence string, userId bson.ObjectID, projectId string, llmProvider *models.LLMProviderConfig) ([]string, error) {
	bibliography, err := a.GetBibliographyForCitation(ctx, userId, projectId)

	if err != nil {
		return nil, err
	}

	emptyCitation := "none"

	// Bibliography is placed at the start of the prompt to leverage prompt caching
	message := fmt.Sprintf("Bibliography: %s\nSentence: %s\nBased on the sentence and bibliography, suggest only the most relevant citation keys separated by commas with no spaces (e.g. key1,key2). Be selective and only include citations that are directly relevant. Avoid suggesting more than 3 citations. If no relevant citations are found, return '%s'.", bibliography, sentence, emptyCitation)

	_, resp, err := a.ChatCompletionV2(ctx, "gpt-5.2", OpenAIChatHistory{
		openai.SystemMessage("You are a helpful assistant that suggests relevant citation keys."),
		openai.UserMessage(message),
	}, llmProvider)

	if err != nil {
		return nil, err
	}

	if len(resp) == 0 {
		return []string{}, nil
	}

	citationKeysStr := strings.TrimSpace(resp[0].Payload.GetAssistant().GetContent())

	if citationKeysStr == "" || citationKeysStr == emptyCitation {
		return []string{}, nil
	}

	// Parse comma-separated keys
	var result []string
	for _, key := range strings.Split(citationKeysStr, ",") {
		if trimmed := strings.TrimSpace(key); trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result, nil
}
