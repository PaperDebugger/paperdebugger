package tools

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
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	"time"

	"github.com/openai/openai-go/v2/packages/param"
	"github.com/openai/openai-go/v2/responses"
	openaiv3 "github.com/openai/openai-go/v3"
	paramv3 "github.com/openai/openai-go/v3/packages/param"
)

type PaperScoreTool struct {
	Description      responses.ToolUnionParam
	toolCallRecordDB *toolCallRecordDB.ToolCallRecordDB
	projectService   *services.ProjectService
	coolDownTime     time.Duration
	baseURL          string
	client           *http.Client
}

var PaperScoreToolDescription = responses.ToolUnionParam{
	OfFunction: &responses.FunctionToolParam{
		Name:        "paper_score",
		Description: param.NewOpt("Score the paper and return its score, percentile, details, and suggestions. After scoring, call paper_score_comment to generate author-facing, actionable, Overleaf-ready review comments."),
		// No parameters, because we can get the paper content from the database.
	},
}

var PaperScoreToolDescriptionV2 = openaiv3.ChatCompletionToolUnionParam{
	OfFunction: &openaiv3.ChatCompletionFunctionToolParam{
		Function: openaiv3.FunctionDefinitionParam{
			Name:        "paper_score",
			Description: paramv3.NewOpt("Score the paper and return its score, percentile, details, and suggestions. After scoring, call paper_score_comment to generate author-facing, actionable, Overleaf-ready review comments."),
			Parameters: openaiv3.FunctionParameters{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	},
}

func NewPaperScoreTool(db *db.DB, projectService *services.ProjectService) *PaperScoreTool {
	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	return &PaperScoreTool{
		Description:      PaperScoreToolDescription,
		toolCallRecordDB: toolCallRecordDB,
		projectService:   projectService,
		coolDownTime:     5 * time.Minute,
		baseURL:          "http://paperdebugger-mcp-server:8000/paper-score",
		client:           &http.Client{},
	}
}

func (t *PaperScoreTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	fullContent, category, err := t.prepare(ctx)
	if err != nil {
		return "", "", err
	}

	// Create function call record
	record, err := t.toolCallRecordDB.Create(ctx, toolCallId, *t.Description.GetName(), map[string]any{
		"latexSource": fullContent,
		"category":    category,
	})
	if err != nil {
		return "", "", err
	}

	resp, err := t.ScorePaper(fullContent, category)
	if err != nil {
		err = fmt.Errorf("failed to score paper: %v", err)
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}

	rawJson, err := json.Marshal(resp)
	if err != nil {
		err = fmt.Errorf("failed to marshal paper score result: %v, rawJson: %v", err, string(rawJson))
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}
	t.toolCallRecordDB.OnSuccess(ctx, record, string(rawJson))

	// Return the JSON format to LLM. Do not return details and suggestions here, because they are already included in rawJson.
	responseJSON, err := json.Marshal(map[string]any{
		"score":      resp.Score,
		"percentile": resp.Percentile,
	})
	if err != nil {
		err = fmt.Errorf("failed to marshal paper score result to LLM: %v, rawJson: %v", err, string(rawJson))
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}

	furtherInstruction := "Then, call the paper_score_comment function to generate step-by-step, author-facing review comments that can be added to Overleaf."
	return string(responseJSON), furtherInstruction, nil
}

func (t *PaperScoreTool) prepare(ctx context.Context) (fullContent string, category string, err error) {
	actor, projectId, conversationID := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" || conversationID == "" {
		return "", "", errors.New("failed to get actor, project id, or conversation id")
	}

	project, err := t.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", errors.New("failed to get project: " + err.Error())
	}

	fullContent, err = project.GetFullContent()
	if err != nil {
		return "", "", errors.New("failed to get paper full content: " + err.Error())
	}

	projectCategory, err := t.projectService.GetProjectCategory(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", errors.New("failed to get paper category: " + err.Error())
	}

	err = t.toolCallRecordDB.CheckCoolDown(ctx, *t.Description.GetName(), actor.ID.Hex(), projectId, t.coolDownTime)
	if err != nil {
		return "", "", errors.New("cool down: " + err.Error())
	}

	return fullContent, projectCategory.Category, nil
}

func (t *PaperScoreTool) ScorePaper(latexSource string, category string) (*projectv1.PaperScoreResult, error) {
	reqBody := struct {
		LatexSource string `json:"latexSource"`
		Category    string `json:"category"`
	}{
		LatexSource: latexSource,
		Category:    category,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", t.baseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var scores projectv1.PaperScoreResult
	err = json.Unmarshal(body, &scores)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response body: %w, body: %s", err, string(body))
	}

	return &scores, nil
}
