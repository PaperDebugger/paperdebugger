package xtramcp

import (
	"encoding/json"
	"fmt"
	"strings"
)

// extracts JSON data from SSE format response
// SSE format:
//
//	event: message
//	data: { <JsonRPC format> }
func parseSSEResponse(body []byte) (string, error) {
	lines := strings.Split(string(body), "\n")

	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			jsonData := strings.TrimPrefix(line, "data: ")
			return jsonData, nil
		}
	}

	return "", fmt.Errorf("no data line found in SSE response")
}

// JSONRPCResponse represents the JSON-RPC 2.0 response structure from Python backend
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"` // Use RawMessage to preserve inner JSON
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// MCP result structs
type MCPToolResult struct {
	Content []MCPContentBlock `json:"content"`
}

type MCPContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// unwrapJSONRPC extracts the inner result from JSON-RPC 2.0 response
// Input: {"jsonrpc":"2.0","id":4,"result":{<XtraMCPToolResult>}}
// Output: {<XtraMCPToolResult>}
// Returns the inner result as string, or error if JSON-RPC error present
func unwrapJSONRPC(jsonRPCStr string) (string, error) {
	var rpcResp JSONRPCResponse

	// Try to unmarshal as JSON-RPC
	if err := json.Unmarshal([]byte(jsonRPCStr), &rpcResp); err != nil {
		// Not JSON-RPC format - return as-is (backward compatibility with legacy tools)
		return jsonRPCStr, nil
	}

	// Check for JSON-RPC error response
	if rpcResp.Error != nil {
		return "", fmt.Errorf("JSON-RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	// Validate it looks like JSON-RPC (has jsonrpc field)
	if rpcResp.JSONRPC == "" {
		// Not actually JSON-RPC format - return as-is
		return jsonRPCStr, nil
	}

	var toolResult MCPToolResult
	if err := json.Unmarshal(rpcResp.Result, &toolResult); err != nil {
		// not conventional MCP result, return raw result
		return string(rpcResp.Result), nil
	}

	// Extract and return inner result
	// TODO: can consider handling multi-modality in the future
	// presently, just return the text content of the first text block
	for _, block := range toolResult.Content {
		if block.Type == "text" {
			// Return the text content of the first text block
			return block.Text, nil
		}
	}

	return "", fmt.Errorf("MCP result had no extractable content")
}
