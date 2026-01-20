package overleaf

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"paperdebugger/internal/libs/contextutil"
)

// Client is an HTTP client for Overleaf API calls.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new Overleaf API client.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    "https://www.overleaf.com",
	}
}

// NewClientWithBaseURL creates a new Overleaf API client with a custom base URL.
// Useful for testing or self-hosted Overleaf instances.
func NewClientWithBaseURL(baseURL string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    baseURL,
	}
}

// CreateDocRequest represents the request body for creating a document.
type CreateDocRequest struct {
	ParentFolderID string `json:"parent_folder_id"`
	Name           string `json:"name"`
}

// CreateDocResponse represents the response from creating a document.
type CreateDocResponse struct {
	ID   string `json:"_id"`
	Name string `json:"name"`
}

// CreateFolderRequest represents the request body for creating a folder.
type CreateFolderRequest struct {
	ParentFolderID string `json:"parent_folder_id"`
	Name           string `json:"name"`
}

// CreateFolderResponse represents the response from creating a folder.
type CreateFolderResponse struct {
	ID   string `json:"_id"`
	Name string `json:"name"`
}

// DeleteDocRequest represents the request for deleting a document.
type DeleteDocRequest struct {
	DocID string
}

// DeleteFolderRequest represents the request for deleting a folder.
type DeleteFolderRequest struct {
	FolderID string
}

// getAuthFromContext extracts Overleaf auth from context and validates it.
func getAuthFromContext(ctx context.Context) (*contextutil.OverleafAuth, error) {
	auth, err := contextutil.GetOverleafAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("overleaf auth not found in context: %w", err)
	}
	if auth.Session == "" {
		return nil, fmt.Errorf("overleaf session cookie is empty")
	}
	if auth.ProjectID == "" {
		return nil, fmt.Errorf("overleaf project ID is empty")
	}
	return auth, nil
}

// buildCookieHeader builds the Cookie header value from auth.
func buildCookieHeader(auth *contextutil.OverleafAuth) string {
	cookie := fmt.Sprintf("overleaf_session2=%s", auth.Session)
	if auth.GCLB != "" {
		cookie += fmt.Sprintf("; GCLB=%s", auth.GCLB)
	}
	return cookie
}

// doRequest performs an HTTP request with common headers and error handling.
func (c *Client) doRequest(ctx context.Context, method, url string, body interface{}) ([]byte, error) {
	auth, err := getAuthFromContext(ctx)
	if err != nil {
		return nil, err
	}

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	httpReq, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Cookie", buildCookieHeader(auth))
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("overleaf API error: status=%d, body=%s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// CreateDoc creates a new document in the Overleaf project.
// The project ID is taken from the context's OverleafAuth.
func (c *Client) CreateDoc(ctx context.Context, req *CreateDocRequest) (*CreateDocResponse, error) {
	auth, err := getAuthFromContext(ctx)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/project/%s/doc", c.baseURL, auth.ProjectID)
	respBody, err := c.doRequest(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}

	var result CreateDocResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// CreateFolder creates a new folder in the Overleaf project.
func (c *Client) CreateFolder(ctx context.Context, req *CreateFolderRequest) (*CreateFolderResponse, error) {
	auth, err := getAuthFromContext(ctx)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/project/%s/folder", c.baseURL, auth.ProjectID)
	respBody, err := c.doRequest(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}

	var result CreateFolderResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// DeleteDoc deletes a document from the Overleaf project.
func (c *Client) DeleteDoc(ctx context.Context, req *DeleteDocRequest) error {
	auth, err := getAuthFromContext(ctx)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/project/%s/doc/%s", c.baseURL, auth.ProjectID, req.DocID)
	_, err = c.doRequest(ctx, "DELETE", url, nil)
	return err
}

// DeleteFolder deletes a folder from the Overleaf project.
func (c *Client) DeleteFolder(ctx context.Context, req *DeleteFolderRequest) error {
	auth, err := getAuthFromContext(ctx)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/project/%s/folder/%s", c.baseURL, auth.ProjectID, req.FolderID)
	_, err = c.doRequest(ctx, "DELETE", url, nil)
	return err
}
