package xtragpt

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
	"strings"
	"time"

	"github.com/openai/openai-go/v2"
	"github.com/openai/openai-go/v2/packages/param"
	"github.com/openai/openai-go/v2/responses"
	"github.com/samber/lo"
)

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

type SearchPapersTool struct {
	Description      responses.ToolUnionParam
	toolCallRecordDB *toolCallRecordDB.ToolCallRecordDB
	projectService   *services.ProjectService
	coolDownTime     time.Duration
	baseURL          string
	client           *http.Client
}

func NewSearchPapersTool(db *db.DB, projectService *services.ProjectService) *SearchPapersTool {
	// Create and populate schema
	var schema map[string]any
	json.Unmarshal([]byte(`{"properties":{"query":{"description":"Keywords, topics, content, or a chunk of text to search for.","examples":["time series token merging","neural networks","...when trained on first-order Markov chains, transformers with two or more layers consistently develop an induction head mechanism to estimate the in-context bigram conditional distribution"],"title":"Query","type":"string"},"top_k":{"description":"Number of top relevant or similar papers to return.","title":"Top K","type":"integer"},"date_min":{"description":"Minimum publication date (YYYY-MM-DD) to filter papers.","examples":["2023-01-01","2022-06-25"],"title":"Date Min","type":"string"},"date_max":{"description":"Maximum publication date (YYYY-MM-DD) to filter papers.","examples":["2024-12-31","2023-06-25"],"title":"Date Max","type":"string"},"countries":{"anyOf":[{"items":{"type":"string"},"type":"array"},{"type":"null"}],"description":"List of country codes in ISO ALPHA-3 format to filter papers by author affiliations.","examples":[["USA","CHN","SGP","GBR","DEU","KOR","JPN"]],"title":"Countries"},"min_similarity":{"description":"Minimum similarity score (0.0-1.0) for returned papers. Higher values yield more relevant results but fewer papers.","examples":[0.3,0.5,0.7,0.9],"title":"Min Similarity","type":"number"}},"required":["query","top_k","countries","min_similarity"],"title":"search_papers_toolArguments","type":"object"}`), &schema)
	
	// Create tool description with populated schema
	description := responses.ToolUnionParam{
		OfFunction: &responses.FunctionToolParam{
			Name:        "search_relevant_papers",
			Description: param.NewOpt("Search for similar or relevant papers by keywords against the local database of academic papers. This tool uses semantic search with vector embeddings to find the most relevant results. It is the default and recommended tool for paper searches."),
			Parameters:  openai.FunctionParameters(schema),
		},
	}
	
	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	return &SearchPapersTool{
		Description:      description,
		toolCallRecordDB: toolCallRecordDB,
		projectService:   projectService,
		coolDownTime:     5 * time.Minute,
		// baseURL:          "http://xtragpt-mcp-server:8080/mcp",
		baseURL:          "http://localhost:8080/mcp", // For local development
		client:           &http.Client{},
	}
}

type SearchPapersToolArgs struct {
	Query         string    `json:"query"`
	TopK          int       `json:"top_k"`
	DateMin       *string   `json:"date_min,omitempty"`
	DateMax       *string   `json:"date_max,omitempty"`
	Countries     []string  `json:"countries"`
	MinSimilarity float64   `json:"min_similarity"`
}

func (t *SearchPapersTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var argsMap SearchPapersToolArgs
	err := json.Unmarshal(args, &argsMap)
	if err != nil {
		return "", "", err
	}

	// Create function call record
	record, err := t.toolCallRecordDB.Create(ctx, toolCallId, *t.Description.GetName(), map[string]any{
		"query":          argsMap.Query,
		"top_k":          argsMap.TopK,
		"date_min":       argsMap.DateMin,
		"date_max":       argsMap.DateMax,
		"countries":      argsMap.Countries,
		"min_similarity": argsMap.MinSimilarity,
	})
	if err != nil {
		return "", "", err
	}

	respStr, err := t.SearchPaper(argsMap.Query, argsMap.TopK, argsMap.DateMin, argsMap.DateMax, argsMap.Countries, argsMap.MinSimilarity)
	if err != nil {
		err = fmt.Errorf("failed to search paper: %v", err)
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}

	rawJson, err := json.Marshal(respStr)
	if err != nil {
		err = fmt.Errorf("failed to marshal paper search result: %v, rawJson: %v", err, string(rawJson))
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}
	t.toolCallRecordDB.OnSuccess(ctx, record, string(rawJson))

	return respStr, "", nil
}

func (t *SearchPapersTool) SearchPaper(query string, topK int, dateMin *string, dateMax *string, countries []string, minSimilarity float64) (string, error) {
	sessionId, err := MCPInitialize(t.baseURL)
	if err != nil {
		fmt.Printf("Error initializing MCP: %v\n", err)
		return "", fmt.Errorf("failed to initialize MCP: %w", err)
	}
	if sessionId == "" {
		return "", fmt.Errorf("failed to initialize MCP")
	}

	fmt.Println("sessionId", sessionId)
	request := MCPRequest{
		JSONRPC: "2.0",
		Method:  "tools/call",
		ID:      2,
		Params: MCPParams{
			Name: "search_relevant_papers",
			Arguments: map[string]interface{}{
				"query":          query,
				"top_k":          topK,
				"date_min":       dateMin,
				"date_max":       dateMax,
				"countries":      countries,
				"min_similarity": minSimilarity,
			},
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
	req.Header.Set("mcp-session-id", sessionId)

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
	fmt.Println("body", string(body))
	// split lines
	lines := strings.Split(string(body), "\n")
	// keep only the line starts with "data:"
	lines = lo.Filter(lines, func(line string, _ int) bool {
		return strings.HasPrefix(line, "data:")
	})
	if len(lines) == 0 {
		return "", fmt.Errorf("no data line found")
	}
	line := lines[0]
	line = strings.TrimPrefix(line, "data: ")
	return line, nil
}
