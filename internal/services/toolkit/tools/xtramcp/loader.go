package xtramcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/registry"
)

// MCPListToolsResponse represents the JSON-RPC response from tools/list method
type MCPListToolsResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Result  struct {
		Tools []ToolSchema `json:"tools"`
	} `json:"result"`
}

// loads tools dynamically from backend
type XtraMCPLoader struct {
	db             *db.DB
	projectService *services.ProjectService
	baseURL        string
	client         *http.Client
	sessionID      string // Store the MCP session ID after initialization for re-use
}

// NewXtraMCPLoader creates a new dynamic XtraMCP loader
func NewXtraMCPLoader(db *db.DB, projectService *services.ProjectService, baseURL string) *XtraMCPLoader {
	return &XtraMCPLoader{
		db:             db,
		projectService: projectService,
		baseURL:        baseURL,
		client:         &http.Client{},
	}
}

// LoadToolsFromBackend fetches tool schemas from backend and registers them
func (loader *XtraMCPLoader) LoadToolsFromBackend(toolRegistry *registry.ToolRegistry) error {
	if loader.sessionID == "" {
		return fmt.Errorf("MCP session not initialized - call InitializeMCP first")
	}

	// Fetch tools from backend using the established session
	toolSchemas, err := loader.fetchAvailableTools()
	if err != nil {
		return fmt.Errorf("failed to fetch tools from backend: %w", err)
	}

	// Register each tool dynamically, passing the session ID
	for _, toolSchema := range toolSchemas {
		dynamicTool := NewDynamicTool(loader.db, loader.projectService, toolSchema, loader.baseURL, loader.sessionID)

		// Register the tool with the registry
		toolRegistry.Register(toolSchema.Name, dynamicTool.Description, dynamicTool.Call)

		fmt.Printf("Registered dynamic tool: %s\n", toolSchema.Name)
	}

	return nil
}

// InitializeMCP performs the full MCP initialization handshake, stores session ID, and returns it
func (loader *XtraMCPLoader) InitializeMCP() (string, error) {
	// Step 1: Initialize
	sessionID, err := loader.performInitialize()
	if err != nil {
		return "", fmt.Errorf("step 1 - initialize failed: %w", err)
	}

	// Step 2: Send notifications/initialized
	err = loader.sendInitializedNotification(sessionID)
	if err != nil {
		return "", fmt.Errorf("step 2 - notifications/initialized failed: %w", err)
	}

	// Store session ID for future use and return it
	loader.sessionID = sessionID

	return sessionID, nil
}

// performInitialize performs MCP initialization (1. establish connection)
func (loader *XtraMCPLoader) performInitialize() (string, error) {
	initReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "initialize",
		"id":      1,
		"params": map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "paperdebugger-client",
				"version": "1.0.0",
			},
		},
	}

	jsonData, err := json.Marshal(initReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal initialize request: %w", err)
	}

	req, err := http.NewRequest("POST", loader.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create initialize request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	resp, err := loader.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make initialize request: %w", err)
	}
	defer resp.Body.Close()

	// Extract session ID from response headers
	sessionID := resp.Header.Get("mcp-session-id")
	if sessionID == "" {
		return "", fmt.Errorf("no session ID returned from initialize")
	}

	return sessionID, nil
}

// sendInitializedNotification completes MCP initialization (acknowledges initialization)
func (loader *XtraMCPLoader) sendInitializedNotification(sessionID string) error {
	notifyReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "notifications/initialized",
		"params":  map[string]interface{}{},
	}

	jsonData, err := json.Marshal(notifyReq)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequest("POST", loader.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create notification request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("mcp-session-id", sessionID)

	resp, err := loader.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// fetchAvailableTools makes a request to get available tools from backend
func (loader *XtraMCPLoader) fetchAvailableTools() ([]ToolSchema, error) {
	// List all tools using the established session
	requestBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/list",
		"params":  map[string]interface{}{},
		"id":      2,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", loader.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("mcp-session-id", loader.sessionID)

	resp, err := loader.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read the raw response body (SSE format) for debugging
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	extractedJSON, err := parseSSEResponse(bodyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SSE response: %w", err)
	}

	// Parse the extracted JSON
	var mcpResponse MCPListToolsResponse
	err = json.Unmarshal([]byte(extractedJSON), &mcpResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON from SSE data: %w. JSON data: %s", err, extractedJSON)
	}

	return mcpResponse.Result.Tools, nil
}
