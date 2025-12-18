package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var SearchStringToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "search_string",
			Description: param.NewOpt("Searches for a string pattern in files within a specified directory. Supports regex patterns and can limit results."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern": map[string]any{
						"type":        "string",
						"description": "The search pattern (string or regex) to look for.",
					},
					"path": map[string]any{
						"type":        "string",
						"description": "The directory path to search within.",
					},
					"file_pattern": map[string]any{
						"type":        "string",
						"description": "Optional glob pattern to filter files (e.g., '*.go', '*.py'). Default is all files.",
					},
					"case_sensitive": map[string]any{
						"type":        "boolean",
						"description": "Whether the search should be case-sensitive. Default is true.",
					},
					"max_results": map[string]any{
						"type":        "integer",
						"description": "Maximum number of results to return. Default is 100.",
					},
				},
				"required": []string{"pattern", "path"},
			},
		},
	},
}

type SearchStringArgs struct {
	Pattern       string `json:"pattern"`
	Path          string `json:"path"`
	FilePattern   string `json:"file_pattern,omitempty"`
	CaseSensitive *bool  `json:"case_sensitive,omitempty"`
	MaxResults    *int   `json:"max_results,omitempty"`
}

func SearchStringTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchStringArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	caseSensitive := true
	if getArgs.CaseSensitive != nil {
		caseSensitive = *getArgs.CaseSensitive
	}
	maxResults := 100
	if getArgs.MaxResults != nil {
		maxResults = *getArgs.MaxResults
	}
	filePattern := "*"
	if getArgs.FilePattern != "" {
		filePattern = getArgs.FilePattern
	}

	// TODO: Implement actual string search logic
	return fmt.Sprintf("[DUMMY] Searched for pattern '%s' in '%s' (file_pattern: %s, case_sensitive: %v, max_results: %d). No results found.",
		getArgs.Pattern, getArgs.Path, filePattern, caseSensitive, maxResults), "", nil
}
