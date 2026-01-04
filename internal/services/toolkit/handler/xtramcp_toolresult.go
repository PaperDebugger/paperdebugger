package handler

import (
	"encoding/json"
	"strings"
)

// XtraMCPToolResult represents the standardized response from XtraMCP tools
// This format is specific to XtraMCP backend and not used by other MCP servers
type XtraMCPToolResult struct {
	SchemaVersion string                 `json:"schema_version"` // "xtramcp.tool_result_v{version}"
	DisplayMode   string                 `json:"display_mode"`   // "verbatim" or "interpret"
	Instructions  *string                `json:"instructions"`   // Optional: instruction template for interpret mode
	Content       interface{}            `json:"content"`        // Optional: string for verbatim, dict/list for interpret (can be nil on error)
	Success       bool                   `json:"success"`        // Explicit success flag
	Error         *string                `json:"error"`          // Optional: error message if success=false
	Metadata      map[string]interface{} `json:"metadata"`       // Optional: tool-specific data (nil if not provided)
}

// ParseXtraMCPToolResult attempts to parse a tool response as XtraMCP ToolResult format
// Returns (result, isXtraMCPFormat, error)
// If the result is not in XtraMCP format, isXtraMCPFormat will be false (not an error)
func ParseXtraMCPToolResult(rawResult string) (*XtraMCPToolResult, bool, error) {
	var result XtraMCPToolResult

	// Attempt to unmarshal as ToolResult
	if err := json.Unmarshal([]byte(rawResult), &result); err != nil {
		// Not ToolResult format - this is OK, might be legacy format
		return nil, false, nil
	}

	// Validate that it's actually a ToolResult (has required fields)
	// check if SchemaVersion is prefixed with xtramcp.tool_result
	if result.SchemaVersion == "" || !strings.HasPrefix(result.SchemaVersion, "xtramcp.tool_result") {
		// not our XtraMCP ToolResult format
		return nil, false, nil
	}

	// Validate display_mode value
	if result.DisplayMode != "verbatim" && result.DisplayMode != "interpret" {
		// Invalid display_mode - not a valid ToolResult
		return nil, false, nil
	}

	// Valid ToolResult format
	// Note: Content, Error, Metadata, and Instructions are all optional and can be nil/empty
	return &result, true, nil
}

// GetContentAsString extracts content as string (for verbatim mode)
// Returns empty string if content is nil
func (tr *XtraMCPToolResult) GetContentAsString() string {
	// Handle nil content (e.g., on error)
	if tr.Content == nil {
		return ""
	}

	if str, ok := tr.Content.(string); ok {
		return str
	}
	// Fallback: JSON encode if not a string
	bytes, _ := json.Marshal(tr.Content)
	return string(bytes)
}

func TruncateContent(content string, maxLen int) string {
	if len(content) <= maxLen {
		return content
	}
	return content[:maxLen] + "..."
}
