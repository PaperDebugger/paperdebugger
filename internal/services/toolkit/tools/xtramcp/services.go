package xtramcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// PaperAbstractResponse represents the response from XtraMCP paper-abstract REST API
type PaperAbstractResponse struct {
	Success  bool   `json:"success"`
	Found    bool   `json:"found"`
	Title    string `json:"title"`
	Abstract string `json:"abstract"`
}

// PaperAbstractsRequest represents the request body for batch paper abstracts API
type PaperAbstractsRequest struct {
	Titles []string `json:"titles"`
}

// PaperAbstractsResponse represents the response from batch paper abstracts API
type PaperAbstractsResponse struct {
	Success bool                    `json:"success"`
	Results []PaperAbstractResponse `json:"results"`
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

// GetPaperAbstracts fetches abstracts for multiple papers in a single request
func (s *XtraMCPServices) GetPaperAbstracts(ctx context.Context, titles []string) (*PaperAbstractsResponse, error) {
	if len(titles) == 0 {
		return &PaperAbstractsResponse{Success: true, Results: []PaperAbstractResponse{}}, nil
	}

	baseURL := strings.TrimSuffix(s.baseURL, "/mcp")
	endpoint := fmt.Sprintf("%s/api/paper-abstracts", baseURL)

	reqBody, err := json.Marshal(PaperAbstractsRequest{Titles: titles})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result PaperAbstractsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
