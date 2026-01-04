package xtramcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/services"
	toolCallRecordDB "paperdebugger/internal/services/toolkit/db"
	"time"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/packages/param"
	"github.com/openai/openai-go/v2/responses"
)

// ToolSchema represents the schema from your backend
type ToolSchema struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	InputSchema  map[string]interface{} `json:"inputSchema"`
	OutputSchema map[string]interface{} `json:"outputSchema"`
}

// MCPRequest represents the JSON-RPC request structure
type MCPRequest struct {
	JSONRPC string    `json:"jsonrpc"`
	Method  string    `json:"method"`
	ID      int       `json:"id"`
	Params  MCPParams `json:"params"`
}

// MCPParams represents the parameters for the MCP request
type MCPParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// DynamicTool represents a generic tool that can handle any schema
type DynamicTool struct {
	Name              string
	Description       responses.ToolUnionParam
	toolCallRecordDB  *toolCallRecordDB.ToolCallRecordDB
	projectService    *services.ProjectService
	coolDownTime      time.Duration
	baseURL           string
	client            *http.Client
	schema            map[string]interface{}
	sessionID         string // Reuse the session ID from initialization
	requiresInjection bool   // Indicates if this tool needs user/project injection
}

// NewDynamicTool creates a new dynamic tool from a schema
func NewDynamicTool(db *db.DB, projectService *services.ProjectService, toolSchema ToolSchema, baseURL string, sessionID string, requiresInjection bool) *DynamicTool {
	// filter schema if injection is required (hide security context like user_id/project_id from LLM)
	schemaForLLM := toolSchema.InputSchema
	if requiresInjection {
		schemaForLLM = filterSecurityParameters(toolSchema.InputSchema)
	}

	description := responses.ToolUnionParam{
		OfFunction: &responses.FunctionToolParam{
			Name:        toolSchema.Name,
			Description: param.NewOpt(toolSchema.Description),
			Parameters:  openai.FunctionParameters(schemaForLLM), // Use filtered schema
		},
	}

	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	//TODO: consider letting llm client know of output schema too
	return &DynamicTool{
		Name:              toolSchema.Name,
		Description:       description,
		toolCallRecordDB:  toolCallRecordDB,
		projectService:    projectService,
		coolDownTime:      5 * time.Minute,
		baseURL:           baseURL,
		client:            &http.Client{},
		schema:            toolSchema.InputSchema, // Store original schema for validation
		sessionID:         sessionID,              // Store the session ID for reuse
		requiresInjection: requiresInjection,
	}
}

// Call handles the tool execution (generic for any tool)
// DEPRECATED: v1 API is no longer supported. This method should not be called.
func (t *DynamicTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	return "", "", fmt.Errorf("v1 API is deprecated and no longer supported. Please use v2 API instead")
}

// executeTool makes the MCP request (generic for any tool)
func (t *DynamicTool) executeTool(args map[string]interface{}) (string, error) {

	request := MCPRequest{
		JSONRPC: "2.0",
		Method:  "tools/call",
		ID:      int(time.Now().Unix()), // to ensure unique ID; TODO: consider better ID generation
		Params: MCPParams{
			Name:      t.Name,
			Arguments: args,
		},
	}

	// Marshal request to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal MCP request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", t.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("mcp-session-id", t.sessionID) // Use the stored session ID

	// Make the request
	resp, err := t.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	extractedJSON, err := parseSSEResponse(body)
	if err != nil {
		return "", fmt.Errorf("failed to parse SSE response: %w", err)
	}

	return extractedJSON, nil
}
