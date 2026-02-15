package xtramcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// PaperAbstractResponse represents the response from XtraMCP paper-abstract REST API
type PaperAbstractResponse struct {
	Success  bool   `json:"success"`
	Found    bool   `json:"found"`
	Title    string `json:"title"`
	Abstract string `json:"abstract"`
}

// XtraMCPServices provides access to XtraMCP REST APIs that don't require MCP session
type XtraMCPServices struct {
	baseURL string
	client  *http.Client
}

// NewXtraMCPServices creates a new XtraMCP services client
func NewXtraMCPServices(baseURL string) *XtraMCPServices {
	return &XtraMCPServices{
		baseURL: baseURL,
		client:  &http.Client{},
	}
}

// GetPaperAbstract fetches the abstract for a paper given its title via the REST API
func (s *XtraMCPServices) GetPaperAbstract(ctx context.Context, title string) (*PaperAbstractResponse, error) {
	baseURL := strings.TrimSuffix(s.baseURL, "/mcp")
	endpoint := fmt.Sprintf("%s/api/paper-abstract?title=%s", baseURL, url.QueryEscape(title))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result PaperAbstractResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
