package xtragpt_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"paperdebugger/internal/services/toolkit/tools/xtragpt"
	"testing"
)

func TestMCPInitialize_Success(t *testing.T) {
	expectedSessionID := "test-session-123"

	// Mock server that handles both initialize and notifications/initialized requests
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST request, got %s", r.Method)
		}

		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		// Parse request body to determine which request this is
		var reqBody map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Fatalf("Failed to decode request body: %v", err)
		}

		method, ok := reqBody["method"].(string)
		if !ok {
			t.Fatalf("Missing or invalid method field")
		}

		switch method {
		case "initialize":
			// Validate initialize request structure
			if reqBody["jsonrpc"] != "2.0" {
				t.Errorf("Expected jsonrpc 2.0, got %v", reqBody["jsonrpc"])
			}

			if reqBody["id"] != float64(1) {
				t.Errorf("Expected id 1, got %v", reqBody["id"])
			}

			params, ok := reqBody["params"].(map[string]interface{})
			if !ok {
				t.Fatalf("Missing or invalid params field")
			}

			if params["protocolVersion"] != "2024-11-05" {
				t.Errorf("Expected protocolVersion 2024-11-05, got %v", params["protocolVersion"])
			}

			clientInfo, ok := params["clientInfo"].(map[string]interface{})
			if !ok {
				t.Fatalf("Missing or invalid clientInfo field")
			}

			if clientInfo["name"] != "test-client" {
				t.Errorf("Expected client name test-client, got %v", clientInfo["name"])
			}

			if clientInfo["version"] != "1.0.0" {
				t.Errorf("Expected client version 1.0.0, got %v", clientInfo["version"])
			}

			// Set session ID header and return success response
			w.Header().Set("mcp-session-id", expectedSessionID)
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05"}}`)

		case "notifications/initialized":
			// Validate notifications/initialized request
			if reqBody["jsonrpc"] != "2.0" {
				t.Errorf("Expected jsonrpc 2.0, got %v", reqBody["jsonrpc"])
			}

			// Check session ID header
			if r.Header.Get("mcp-session-id") != expectedSessionID {
				t.Errorf("Expected session ID %s, got %s", expectedSessionID, r.Header.Get("mcp-session-id"))
			}

			if r.Header.Get("Accept") != "application/json, text/event-stream" {
				t.Errorf("Expected Accept header 'application/json, text/event-stream', got %s", r.Header.Get("Accept"))
			}

			w.WriteHeader(http.StatusOK)

		default:
			t.Errorf("Unexpected method: %s", method)
		}
	}))
	defer server.Close()

	sessionID, err := xtragpt.MCPInitialize(server.URL)

	if err != nil {
		t.Fatalf("MCPInitialize failed: %v", err)
	}

	if sessionID != expectedSessionID {
		t.Errorf("Expected session ID %s, got %s", expectedSessionID, sessionID)
	}
}

func TestMCPInitialize_InvalidURL(t *testing.T) {
	sessionID, err := xtragpt.MCPInitialize("invalid-url")

	if err == nil {
		t.Fatalf("Expected error for invalid URL, but got none")
	}

	if sessionID != "" {
		t.Errorf("Expected empty session ID on error, got %s", sessionID)
	}
}

func TestMCPNotificationsInitialized_Success(t *testing.T) {
	sessionID := "test-session-456"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST request, got %s", r.Method)
		}

		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		if r.Header.Get("Accept") != "application/json, text/event-stream" {
			t.Errorf("Expected Accept header 'application/json, text/event-stream', got %s", r.Header.Get("Accept"))
		}

		if r.Header.Get("mcp-session-id") != sessionID {
			t.Errorf("Expected session ID %s, got %s", sessionID, r.Header.Get("mcp-session-id"))
		}

		var reqBody map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Fatalf("Failed to decode request body: %v", err)
		}

		if reqBody["jsonrpc"] != "2.0" {
			t.Errorf("Expected jsonrpc 2.0, got %v", reqBody["jsonrpc"])
		}

		if reqBody["method"] != "notifications/initialized" {
			t.Errorf("Expected method notifications/initialized, got %v", reqBody["method"])
		}

		params, ok := reqBody["params"].(map[string]interface{})
		if !ok {
			t.Fatalf("Missing or invalid params field")
		}

		if len(params) != 0 {
			t.Errorf("Expected empty params, got %v", params)
		}

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// This function doesn't return anything, so we just ensure it doesn't panic
	xtragpt.MCPNotificationsInitialized(server.URL, sessionID)
}

func TestMCPNotificationsInitialized_InvalidURL(t *testing.T) {
	// This should not panic even with invalid URL
	xtragpt.MCPNotificationsInitialized("invalid-url", "test-session")
}
