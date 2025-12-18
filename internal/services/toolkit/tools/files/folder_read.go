package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var ReadFolderToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "read_folder",
			Description: param.NewOpt("Lists the contents of a folder (directory) at the specified path. Can optionally list recursively."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The absolute or relative path of the folder to list.",
					},
					"recursive": map[string]any{
						"type":        "boolean",
						"description": "If true, list contents recursively including all subdirectories. Default is false.",
					},
					"max_depth": map[string]any{
						"type":        "integer",
						"description": "Maximum depth to recurse when recursive is true. Default is unlimited.",
					},
					"pattern": map[string]any{
						"type":        "string",
						"description": "Optional glob pattern to filter results (e.g., '*.go', '*.py').",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type ReadFolderArgs struct {
	Path      string `json:"path"`
	Recursive *bool  `json:"recursive,omitempty"`
	MaxDepth  *int   `json:"max_depth,omitempty"`
	Pattern   string `json:"pattern,omitempty"`
}

func ReadFolderTool(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var getArgs ReadFolderArgs

	if err := json.Unmarshal(args, &getArgs); err != nil {
		return "", "", err
	}

	recursive := false
	if getArgs.Recursive != nil {
		recursive = *getArgs.Recursive
	}

	depthStr := "unlimited"
	if getArgs.MaxDepth != nil {
		depthStr = fmt.Sprintf("%d", *getArgs.MaxDepth)
	}

	pattern := "*"
	if getArgs.Pattern != "" {
		pattern = getArgs.Pattern
	}

	// TODO: Implement actual folder listing logic
	return fmt.Sprintf("[DUMMY] Listed folder: %s (recursive: %v, max_depth: %s, pattern: %s)", getArgs.Path, recursive, depthStr, pattern), "", nil
}
