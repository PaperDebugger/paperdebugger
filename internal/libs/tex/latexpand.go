package tex

import (
	"path/filepath"
	"regexp"
	"strings"

	"paperdebugger/internal/libs/shared"
)

// commentRegex matches a LaTeX comment: an unescaped % and everything after it
// until end of line. The leading group captures either start-of-line or a
// non-backslash character, then consumes pairs of backslashes (\\) before %.
// This generalizes to any run of N backslashes preceding %: if N is even
// (including 0), every backslash pairs up as a literal-backslash escape and
// the % is unescaped, so the comment is stripped; if N is odd, the final
// backslash escapes the % itself, so the % (and the surrounding text) is
// preserved.
var commentRegex = regexp.MustCompile(`(^|[^\\])((?:\\\\)*)%.*$`)

func removeComments(text string) string {
	// Split into lines, trim each line and filter empty ones
	lines := strings.Split(text, "\n")
	var result []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		cleaned := commentRegex.ReplaceAllString(trimmed, "$1$2")
		cleaned = strings.TrimSpace(cleaned)
		if len(cleaned) == 0 {
			continue
		}
		result = append(result, cleaned)
	}
	return strings.Join(result, "\n")
}

func expandWithDepth(content string, docs map[string]string, rootDocDir string, depth int) string {
	// max depth is 10
	if depth >= 10 {
		return content
	}

	expanded := content
	inputRegex := regexp.MustCompile(`\\(?:input|include|subfile)\{([^}]+)\}`)
	matches := inputRegex.FindAllStringSubmatch(content, -1)

	for _, match := range matches {
		fullMatch := match[0]
		filename := match[1]

		// Normalize filename
		normalizedFilename := filename
		if !strings.HasSuffix(filename, ".tex") {
			normalizedFilename = filename + ".tex"
		}
		normalizedFilename = strings.TrimSpace(normalizedFilename)
		normalizedFilename = filepath.Join(rootDocDir, normalizedFilename)

		if includedContent, ok := docs[normalizedFilename]; ok {
			expandedContent := expandWithDepth(removeComments(includedContent), docs, rootDocDir, depth+1)
			expanded = strings.Replace(expanded, fullMatch, expandedContent, -1)
		}
	}

	return expanded
}

func Latexpand(docs map[string]string, rootDoc string) (string, error) {
	content, ok := docs[rootDoc]
	rootDocDir := filepath.Dir(rootDoc)

	if !ok {
		return "", shared.ErrBadRequest("root doc not found")
	}

	return expandWithDepth(removeComments(content), docs, rootDocDir, 0), nil
}
