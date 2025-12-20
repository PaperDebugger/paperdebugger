package rules

import (
	"regexp"
	"strings"
)

// ExtractSection content using regex for \section{...} or \chapter{...}
func ExtractSection(content string, pattern string) string {
	lines := strings.Split(content, "\n")
	var sectionLines []string
	found := false

	headerRegex := `\\(chapter|section|subsection|subsubsection)\*?\{.*(` + pattern + `).*\}`
	nextHeaderRegex := `\\(chapter|section|subsection|subsubsection)\*?\{`

	re := regexp.MustCompile("(?i)" + headerRegex)
	nextRe := regexp.MustCompile(nextHeaderRegex)

	for _, line := range lines {
		if re.MatchString(line) {
			found = true
			continue
		}
		if found && nextRe.MatchString(line) {
			break
		}
		if found {
			sectionLines = append(sectionLines, line)
		}
	}

	return strings.Join(sectionLines, "\n")
}
