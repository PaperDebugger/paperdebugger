package xtramcp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"
	toolCallRecordDB "paperdebugger/internal/services/toolkit/db"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// ToolSchema represents the schema from your backend
type ToolSchemaV2 struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	InputSchema  map[string]interface{} `json:"inputSchema"`
	OutputSchema map[string]interface{} `json:"outputSchema"`
}

// MCPRequest represents the JSON-RPC request structure
type MCPRequestV2 struct {
	JSONRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	ID      int         `json:"id"`
	Params  MCPParamsV2 `json:"params"`
}

// MCPParams represents the parameters for the MCP request
type MCPParamsV2 struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// DynamicTool represents a generic tool that can handle any schema
type DynamicToolV2 struct {
	Name              string
	Description       openai.ChatCompletionToolUnionParam
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
func NewDynamicToolV2(db *db.DB, projectService *services.ProjectService, toolSchema ToolSchemaV2, baseURL string, sessionID string, requiresInjection bool) *DynamicToolV2 {
	// filter schema if injection is required (hide security context like user_id/project_id from LLM)
	schemaForLLM := toolSchema.InputSchema
	if requiresInjection {
		schemaForLLM = filterSecurityParameters(toolSchema.InputSchema)
	}

	description := openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        toolSchema.Name,
				Description: param.NewOpt(toolSchema.Description),
				Parameters:  openai.FunctionParameters(schemaForLLM), // Use filtered schema
			},
		},
	}

	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	//TODO: consider letting llm client know of output schema too
	return &DynamicToolV2{
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
func (t *DynamicToolV2) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	// Parse arguments as generic map since we don't know the structure
	var argsMap map[string]interface{}
	err := json.Unmarshal(args, &argsMap)
	if err != nil {
		return "", "", err
	}

	// inject user/project context if required
	if t.requiresInjection {
		err := t.injectSecurityContext(ctx, argsMap)
		if err != nil {
			return "", "", fmt.Errorf("security context injection failed: %w", err)
		}
	}

	record, err := t.toolCallRecordDB.Create(ctx, toolCallId, t.Name, argsMap)
	if err != nil {
		return "", "", err
	}

	// Execute the tool via MCP
	respStr, err := t.executeTool(argsMap)
	if err != nil {
		err = fmt.Errorf("failed to execute tool %s: %v", t.Name, err)
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}

	rawJson, err := json.Marshal(respStr)
	if err != nil {
		err = fmt.Errorf("failed to marshal tool result: %v", err)
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}
	t.toolCallRecordDB.OnSuccess(ctx, record, string(rawJson))

	return respStr, "", nil
}

// extracts user/project from context and injects into arguments
func (t *DynamicToolV2) injectSecurityContext(ctx context.Context, argsMap map[string]interface{}) error {
	// 1. Extract from context
	actor, projectId, _ := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" {
		return fmt.Errorf("authentication required: user context not found")
	}

	// 2. Validate user owns the project
	_, err := t.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return fmt.Errorf("authorization failed: project not found or access denied")
		}
		return fmt.Errorf("authorization check failed: %w", err)
	}

	// 3. Check if tool schema expects these parameters
	properties, ok := t.schema["properties"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid tool schema: properties not found")
	}

	// 4. Inject user_id if expected by tool
	if _, hasUserId := properties["user_id"]; hasUserId {
		argsMap["user_id"] = actor.ID.Hex()
	}

	// 5. Inject project_id if expected by tool
	if _, hasProjectId := properties["project_id"]; hasProjectId {
		argsMap["project_id"] = projectId
	}

	return nil
}

// executeTool makes the MCP request (generic for any tool)
func (t *DynamicToolV2) executeTool(args map[string]interface{}) (string, error) {

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

	// Unwrap JSON-RPC envelope to get inner ToolResult
	// Input: {"jsonrpc":"2.0","id":4,"result":{<ToolResult>}}
	// Output: {<ToolResult>}
	innerResult, err := unwrapJSONRPC(extractedJSON)
	if err != nil {
		return "", fmt.Errorf("JSON-RPC error: %w", err)
	}

	return innerResult, nil
}
