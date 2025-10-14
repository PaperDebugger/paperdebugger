package xtragpt

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type InitializeRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  struct {
		ProtocolVersion string                 `json:"protocolVersion"`
		Capabilities    map[string]interface{} `json:"capabilities"`
		ClientInfo      struct {
			Name    string `json:"name"`
			Version string `json:"version"`
		} `json:"clientInfo"`
	} `json:"params"`
	ID int `json:"id"`
}

type NotificationRequest struct {
	JSONRPC string                 `json:"jsonrpc"`
	Method  string                 `json:"method"`
	Params  map[string]interface{} `json:"params"`
}

type ToolsRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	ID      int    `json:"id"`
}

func MCPNotificationsInitialized(url string, sessionId string) {
	notifyReq := NotificationRequest{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
		Params:  make(map[string]interface{}),
	}

	// Marshal notification to JSON
	notifyJSON, err := json.Marshal(notifyReq)
	if err != nil {
		fmt.Printf("Error marshaling notification JSON: %v\n", err)
		return
	}

	// Create HTTP client and request for notification
	client := &http.Client{}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(notifyJSON))
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("mcp-session-id", sessionId)

	// Make the notification request
	notifyResp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making notification request: %v\n", err)
		return
	}
	defer notifyResp.Body.Close()

}

func MCPInitialize(url string) (string, error) {
	initReq := InitializeRequest{
		JSONRPC: "2.0",
		Method:  "initialize",
		ID:      1,
	}
	initReq.Params.ProtocolVersion = "2024-11-05"
	initReq.Params.Capabilities = make(map[string]interface{})
	initReq.Params.ClientInfo.Name = "test-client"
	initReq.Params.ClientInfo.Version = "1.0.0"

	// Marshal to JSON
	jsonData, err := json.Marshal(initReq)
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		return "", err
	}

	// Make the first request
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error making request: %v\n", err)
		return "", err
	}
	defer resp.Body.Close()
	fmt.Println("Initialize response", resp.Body, resp.Header)

	// Get session ID from headers
	sessionID := resp.Header.Get("mcp-session-id")
	fmt.Printf("Session ID: %s\n", sessionID)

	MCPNotificationsInitialized(url, sessionID)
	fmt.Println("Initialized")
	return sessionID, nil
}

func MCPListTools(url string) ([]string, error) {
	toolsReq := ToolsRequest{
		JSONRPC: "2.0",
		Method:  "tools/list",
		ID:      1,
	}
	jsonData, err := json.Marshal(toolsReq)
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		return nil, err
	}
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error making request: %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()
	fmt.Println("List tools response", resp.Body, resp.Header)
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return nil, err
	}
	fmt.Println("List tools response", string(body))
	return nil, nil
}
