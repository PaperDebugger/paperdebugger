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

// MCPToolsResponse represents the JSON-RPC response from your backend
type MCPToolsResponse struct {
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
	// Initialize MCP session ONCE
	sessionID, err := loader.initializeMCP()
	if err != nil {
		return fmt.Errorf("failed to initialize MCP: %w", err)
	}
	loader.sessionID = sessionID

	// Fetch tools from backend using the session (currently returns mock data)
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

// initializeMCP performs the full MCP initialization handshake
func (loader *XtraMCPLoader) initializeMCP() (string, error) {
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

	// Parse response
	var mcpResponse MCPToolsResponse
	err = json.NewDecoder(resp.Body).Decode(&mcpResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return mcpResponse.Result.Tools, nil
	
	// mock data; return hardcoded tool schemas for testing
	// mockToolsJSON := `[{"name":"get_user_papers","description":"Fetch all papers published by a specific user identified by email. Supports 'summary' (abstract truncated to 150 words) and 'detailed' (full abstract).","inputSchema":{"properties":{"email":{"description":"Email address of the user whose papers to fetch. Must be a valid email string.","examples":["alice@example.com","bob@university.edu"],"title":"Email","type":"string"},"format":{"default":"detailed","description":"Format of the response. 'summary' shows title, venue, authors, URL, and the first 150 words of the abstract (default). 'detailed' shows the full abstract.","enum":["summary","detailed"],"examples":["summary","detailed"],"title":"Format","type":"string"}},"required":["email"],"title":"get_user_papers_toolArguments","type":"object"},"outputSchema":{"properties":{"result":{"title":"Result","type":"string"}},"required":["result"],"title":"get_user_papers_toolOutput","type":"object"}},{"name":"search_papers_on_openreview","description":"Search for academic papers on OpenReview by keywords within specific conference venues. This tool supports various matching modes and is ideal for discovering recent or broader papers beyond those available in the local database. Use this tool when results from search_relevant_papers are insufficient.","inputSchema":{"properties":{"query":{"description":"Keywords, topics, content, or a chunk of text to search for.","examples":["time series token merging","neural networks"],"title":"Query","type":"string"},"venues":{"description":"List of conference venues and years to search in. Each entry must be a dict with 'venue' and 'year'.","examples":[{"venue":"ICLR.cc","year":"2024"},{"venue":"ICML","year":"2024"},{"venue":"NeurIPS.cc","year":"2023"},{"venue":"NeurIPS.cc","year":"2022"}],"items":{"additionalProperties":{"type":"string"},"type":"object"},"minItems":1,"title":"Venues","type":"array"},"search_fields":{"default":["title","abstract"],"description":"Fields to search within each paper. Options: 'title', 'abstract', 'authors'.","items":{"enum":["title","abstract","authors"],"type":"string"},"title":"Search Fields","type":"array"},"match_mode":{"default":"majority","description":"Match mode:\n- any: At least one keyword must match\n- all: All keywords must match\n- exact: Match the entire phrase exactly\n- majority: Match majority of keywords (>50%)\n- threshold: Match percentage of terms based on 'match_threshold'.","enum":["any","all","exact","majority","threshold"],"title":"Match Mode","type":"string"},"match_threshold":{"default":0.5,"description":"Minimum fraction (0.0-1.0) of search terms that must match when using 'threshold' mode. Example: 0.5 = 50% of terms must match.","maximum":1,"minimum":0,"title":"Match Threshold","type":"number"},"limit":{"default":10,"description":"Maximum number of results to return (1-16).","maximum":16,"minimum":1,"title":"Limit","type":"integer"},"min_score":{"default":0.6,"description":"Minimum match score (0.0-1.0). Lower values allow looser matches; higher values enforce stricter matches.","maximum":1,"minimum":0,"title":"Min Score","type":"number"}},"required":["query","venues"],"title":"search_papers_openreview_toolArguments","type":"object"},"outputSchema":{"properties":{"result":{"title":"Result","type":"string"}},"required":["result"],"title":"search_papers_openreview_toolOutput","type":"object"}},{"name":"search_relevant_papers","description":"Search for similar or relevant papers by keywords against the local database of academic papers. This tool uses semantic search with vector embeddings to find the most relevant results. It is the default and recommended tool for paper searches.","inputSchema":{"properties":{"query":{"description":"Keywords, topics, content, or a chunk of text to search for.","examples":["time series token merging","neural networks","...when trained on first-order Markov chains, transformers with two or more layers consistently develop an induction head mechanism to estimate the in-context bigram conditional distribution"],"title":"Query","type":"string"},"top_k":{"description":"Number of top relevant or similar papers to return.","title":"Top K","type":"integer"},"date_min":{"description":"Minimum publication date (YYYY-MM-DD) to filter papers.","examples":["2023-01-01","2022-06-25"],"title":"Date Min","type":"string"},"date_max":{"description":"Maximum publication date (YYYY-MM-DD) to filter papers.","examples":["2024-12-31","2023-06-25"],"title":"Date Max","type":"string"},"countries":{"anyOf":[{"items":{"type":"string"},"type":"array"},{"type":"null"}],"description":"List of country codes in ISO ALPHA-3 format to filter papers by author affiliations.","examples":[["USA","CHN","SGP","GBR","DEU","KOR","JPN"]],"title":"Countries"},"min_similarity":{"description":"Minimum similarity score (0.0-1.0) for returned papers. Higher values yield more relevant results but fewer papers.","examples":[0.3,0.5,0.7,0.9],"title":"Min Similarity","type":"number"}},"required":["query","top_k","countries","min_similarity"],"title":"search_papers_toolArguments","type":"object"},"outputSchema":{"properties":{"result":{"title":"Result","type":"string"}},"required":["result"],"title":"search_papers_toolOutput","type":"object"}},{"name":"identify_improvements","description":"Analyzes a draft academic paper against the standards of top-tier ML conferences (ICLR, ICML, NeurIPS). Identifies issues in structure, completeness, clarity, and argumentation, then provides prioritized, actionable suggestions.","inputSchema":{"properties":{"paper_content":{"description":"The full text content of the academic paper draft. Paper content should not be truncated.","title":"Paper Content","type":"string"},"target_venue":{"default":"NeurIPS","description":"The target top-tier conference to tailor the feedback for.","enum":["ICLR","ICML","NeurIPS"],"title":"Target Venue","type":"string"},"focus_areas":{"anyOf":[{"items":{"enum":["Structure","Clarity","Evidence","Positioning","Style","Completeness","Soundness","Limitations"],"type":"string"},"type":"array"},{"type":"null"}],"default":null,"description":"List of specific areas to focus the analysis on. If empty, default areas are: {DEFAULT_FOCUS_AREAS}.","title":"Focus Areas"},"severity_threshold":{"default":"major","description":"The minimum severity level to report. 'major' will show blockers and major issues.","enum":["blocker","major","minor","nit"],"title":"Severity Threshold","type":"string"}},"required":["paper_content"],"title":"identify_improvementsArguments","type":"object"},"outputSchema":{"properties":{"result":{"title":"Result","type":"string"}},"required":["result"],"title":"identify_improvementsOutput","type":"object"}},{"name":"enhance_academic_writing","description":"Suggest context-aware academic paper writing enhancements for selected text.","inputSchema":{"properties":{"full_paper_content":{"description":"Surrounding context from the manuscript (e.g., abstract, background, or several sections). This need not be the entire paper; providing a substantial excerpt helps tailor the tone, terminology, and level of detail to academic venues (journals and conferences).","examples":["In reinforcement learning, one could structure these metrics (previously for evaluation) as rewards that could be boosted during training (Sharma et al., 2021; Yadav et al., 2021; Deng et al., 2022; Liu et al., 2023a; Xu et al., 2024; Wang et al., 2024b), to optimize complex objective functions even at testing time (OpenAI, 2024). However, when reward weights remain static, the weakest metric (the 'short-board') becomes a bottleneck that restricts overall LLM effectiveness, which introduces the short-board effect in multi-reward optimization. For example, in Figure 2, when the scaled reward itself (or its growth trend) has not yet reached saturation, its update magnitude should accordingly be increased."],"title":"Full Paper Content","type":"string"},"selected_content":{"description":"The specific text excerpt selected for improvement from the paper.","examples":["...when the scaled reward itself (or its growth trend) has not yet reached saturation, its update magnitude should accordingly be increased..."],"title":"Selected Content","type":"string"}},"required":["full_paper_content","selected_content"],"title":"improve_academic_passage_toolArguments","type":"object"},"outputSchema":{"properties":{"result":{"title":"Result","type":"string"}},"required":["result"],"title":"improve_academic_passage_toolOutput","type":"object"}}]`

	// var mockTools []ToolSchema
	// err := json.Unmarshal([]byte(mockToolsJSON), &mockTools)
}
