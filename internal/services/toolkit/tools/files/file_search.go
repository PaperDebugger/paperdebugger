package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var SearchFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "search_file",
			Description: param.NewOpt("Searches for files by name or pattern within a specified directory. Returns matching file paths."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The directory path to search within.",
					},
					"pattern": map[string]any{
						"type":        "string",
						"description": "The file name pattern to search for (supports glob patterns like '*.go', 'test_*.py').",
					},
					"recursive": map[string]any{
						"type":        "boolean",
						"description": "If true, search recursively in subdirectories. Default is true.",
					},
					"max_results": map[string]any{
						"type":        "integer",
						"description": "Maximum number of results to return. Default is 100.",
					},
				},
				"required": []string{"path", "pattern"},
			},
		},
	},
}

type SearchFileArgs struct {
	Path       string `json:"path"`
	Pattern    string `json:"pattern"`
	Recursive  *bool  `json:"recursive,omitempty"`
	MaxResults *int   `json:"max_results,omitempty"`
}

func SearchFileTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs SearchFileArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	// Default values
	recursive := true
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
	}
	maxResults := 100
	if getArgs.MaxResults != nil {
		maxResults = *getArgs.MaxResults
	}

	// TODO: Implement actual file search logic
	return fmt.Sprintf("[DUMMY] Searched for files matching '%s' in '%s' (recursive: %v, max_results: %d). No files found.",
		getArgs.Pattern, getArgs.Path, recursive, maxResults), "", nil
}
