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

// Venue represents a conference venue with year
type Venue struct {
	Venue string `json:"venue"`
	Year  string `json:"year"`
}
type SearchPapersTool struct {
	Description      responses.ToolUnionParam
	toolCallRecordDB *toolCallRecordDB.ToolCallRecordDB
	projectService   *services.ProjectService
	coolDownTime     time.Duration
	baseURL          string
	client           *http.Client
}

var schema map[string]any

var SearchPapersToolDescription = responses.ToolUnionParam{
	OfFunction: &responses.FunctionToolParam{
		Name:        "search_papers",
		Description: param.NewOpt("Search for papers by keywords within specific conference venues, with various matching modes."),
		Parameters:  openai.FunctionParameters(schema),
	},
}

func NewSearchPapersTool(db *db.DB, projectService *services.ProjectService) *SearchPapersTool {
	json.Unmarshal([]byte(`{"properties":{"query":{"description":"Keywords / topics or content to search for (e.g., 'time series token merging', 'neural networks').","title":"Query","type":"string"},"venues":{"description":"List of conference venues and years to search in. Each entry must be a dict with 'venue' (e.g., 'ICLR.cc', 'NeurIPS.cc', 'ICML.cc'; users may omit '.cc') and 'year' (e.g., '2024', '2025').","items":{"additionalProperties":{"type":"string"},"type":"object"},"minItems":1,"title":"Venues","type":"array"},"search_fields":{"default":["title","abstract"],"description":"Fields to search within each paper. Options: 'title', 'abstract', 'authors'.","items":{"enum":["title","abstract","authors"],"type":"string"},"title":"Search Fields","type":"array"},"match_mode":{"default":"majority","description":"Match mode:\n- any: At least one keyword must match\n- all: All keywords must match\n- exact: Match the entire phrase exactly\n- majority: Match majority of keywords (>50%)\n- threshold: Match percentage of terms based on 'match_threshold'.","enum":["any","all","exact","majority","threshold"],"title":"Match Mode","type":"string"},"match_threshold":{"default":0.5,"description":"Minimum fraction (0.0-1.0) of search terms that must match when using 'threshold' mode. Example: 0.5 = 50% of terms must match.","maximum":1,"minimum":0,"title":"Match Threshold","type":"number"},"limit":{"default":10,"description":"Maximum number of results to return (1-16).","maximum":16,"minimum":1,"title":"Limit","type":"integer"},"min_score":{"default":0.6,"description":"Minimum match score (0.0-1.0). Lower values allow looser matches; higher values enforce stricter matches.","maximum":1,"minimum":0,"title":"Min Score","type":"number"}},"required":["query","venues"],"title":"search_papers_toolArguments","type":"object"}`), &schema)
	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	return &SearchPapersTool{
		Description:      SearchPapersToolDescription,
		toolCallRecordDB: toolCallRecordDB,
		projectService:   projectService,
		coolDownTime:     5 * time.Minute,
		baseURL:          "http://xtragpt-mcp-server:8080/paper-score",
		client:           &http.Client{},
	}
}

type SearchPapersToolArgs struct {
	Limit          int      `json:"limit"`
	MatchMode      string   `json:"matchMode"`
	MatchThreshold float64  `json:"matchThreshold"`
	MinScore       float64  `json:"minScore"`
	Query          string   `json:"query"`
	Venues         []Venue  `json:"venues"`
	SearchFields   []string `json:"searchFields"`
}

func (t *SearchPapersTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var argsMap SearchPapersToolArgs
	err := json.Unmarshal(args, &argsMap)
	if err != nil {
		return "", "", err
	}

	// Create function call record
	record, err := t.toolCallRecordDB.Create(ctx, toolCallId, *t.Description.GetName(), map[string]any{
		"limit":          argsMap.Limit,
		"matchMode":      argsMap.MatchMode,
		"matchThreshold": argsMap.MatchThreshold,
		"minScore":       argsMap.MinScore,
		"query":          argsMap.Query,
		"venues":         argsMap.Venues,
		"searchFields":   argsMap.SearchFields,
	})
	if err != nil {
		return "", "", err
	}

	respStr, err := t.SearchPaper(argsMap.Limit, argsMap.MatchMode, argsMap.MatchThreshold, argsMap.MinScore, argsMap.Query, argsMap.Venues, argsMap.SearchFields)
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

func (t *SearchPapersTool) SearchPaper(limit int, matchMode string, matchThreshold float64, minScore float64, query string, venues []Venue, searchFields []string) (string, error) {
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
			Name: "search_papers",
			Arguments: map[string]interface{}{
				"limit":           limit,
				"match_mode":      matchMode,
				"match_threshold": matchThreshold,
				"min_score":       minScore,
				"query":           query,
				"search_fields":   searchFields,
				"venues":          venues,
			},
		},
	}

	// Marshal request to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal MCP request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", "http://localhost:8080/mcp", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("mcp-session-id", sessionId)

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(req)
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
