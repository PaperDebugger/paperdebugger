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
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"
	toolCallRecordDB "paperdebugger/internal/services/toolkit/db"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	"time"

	"github.com/openai/openai-go/v2/packages/param"
	"github.com/openai/openai-go/v2/responses"
)

type PaperScoreCommentRequest struct {
	LatexSource      string                      `json:"latexSource"`
	PaperScoreResult *projectv1.PaperScoreResult `json:"paperScoreResult"`
}

type PaperScoreCommentTool struct {
	Description           responses.ToolUnionParam
	toolCallRecordDB      *toolCallRecordDB.ToolCallRecordDB
	projectService        *services.ProjectService
	reverseCommentService *services.ReverseCommentService
	coolDownTime          time.Duration
	baseURL               string
	client                *http.Client
}

func NewPaperScoreCommentTool(db *db.DB, projectService *services.ProjectService, reverseCommentService *services.ReverseCommentService) *PaperScoreCommentTool {
	toolCallRecordDB := toolCallRecordDB.NewToolCallRecordDB(db)
	paperScoreCommentToolDescription := responses.ToolUnionParam{
		OfFunction: &responses.FunctionToolParam{
			Name:        "paper_score_comment",
			Description: param.NewOpt("Get the actionable comment for the paper score. usually the comment is about the weakness of the paper."),
		},
	}

	return &PaperScoreCommentTool{
		Description:           paperScoreCommentToolDescription,
		toolCallRecordDB:      toolCallRecordDB,
		projectService:        projectService,
		reverseCommentService: reverseCommentService,
		coolDownTime:          5 * time.Minute,
		baseURL:               "http://paperdebugger-mcp-server:8000/paper-score-comments",
		client:                &http.Client{},
	}
}

func (t *PaperScoreCommentTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	// This function should not pass the JSON data returned by paper_score to LLM.
	// Because the output of LLM is unstable.
	// We can read the function_call table in the database in this function to get the return value of paper_score.

	// If there are multiple functions calling at the same time, we can consider returning a unique ID, and then let LLM pass this ID.
	// But this optimization can be considered later, because there is only one function call now.
	actor, projectId, conversationID := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" || conversationID == "" {
		return "", "", errors.New("Failed to get actor, project id, or conversation id")
	}

	fullContent, _, err := t.prepare(ctx)
	if err != nil {
		return "", "", err
	}

	paperScoreRecord, err := t.toolCallRecordDB.GetLatest(ctx, "paper_score", actor.ID.Hex(), projectId)
	if err != nil {
		return "", "", err
	}

	if paperScoreRecord.FunctionStatus != models.FunctionCallStatusSuccess {
		switch paperScoreRecord.FunctionStatus {
		case models.FunctionCallStatusError:
			return "", "", errors.New("paper score is error, paper score comments cannot be generated. please rerun the paper score function.")
		case models.FunctionCallStatusPending:
			return "", "", errors.New("paper score is pending, paper score comments cannot be generated. please wait for a few minutes and try again.")
		case models.FunctionCallStatusTimeout:
			return "", "", errors.New("paper score is timeout, paper score comments cannot be generated. please rerun the paper score function.")
		default:
			return "", "", errors.New("paper score is not completed, paper score comments cannot be generated. please try again.")
		}
	}

	paperScoreResult, err := t.unmarshalPaperScoreResult(paperScoreRecord.FunctionResult)
	if err != nil {
		return "", "", errors.New("failed to unmarshal paper score result: " + err.Error())
	}

	record, err := t.toolCallRecordDB.Create(ctx, toolCallId, *t.Description.GetName(), map[string]any{
		"latexSource":      fullContent,
		"paperScoreResult": paperScoreResult,
	})
	if err != nil {
		return "", "", errors.New("failed to create paper score comment record: " + err.Error())
	}

	paperScoreCommentResult, overleafComments, err := t.execute(ctx, fullContent, paperScoreResult)
	if err != nil {
		err = errors.New("failed to execute paper score comment: " + err.Error())
		t.toolCallRecordDB.OnError(ctx, record, err)
		return "", "", err
	}

	functionCallResultJson, err := json.Marshal(map[string]any{
		"paperScoreCommentResult": paperScoreCommentResult,
		"comments":                overleafComments,
	})
	if err != nil {
		return "", "", errors.New("failed to marshal paper score comment result: " + err.Error())
	}
	t.toolCallRecordDB.OnSuccess(ctx, record, string(functionCallResultJson))

	// Return the JSON to LLM, the repeated PaperScoreCommentResult is the comments.
	responseJSON, err := json.Marshal(overleafComments)
	if err != nil {
		return "", "", errors.New("failed to marshal paper score comment response: " + err.Error())
	}
	return string(responseJSON), "", nil
}

func (t *PaperScoreCommentTool) prepare(ctx context.Context) (fullContent string, category string, err error) {
	actor, projectId, conversationID := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" || conversationID == "" {
		return "", "", errors.New("Failed to get actor, project id, or conversation id")
	}

	project, err := t.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", errors.New("Failed to get project: " + err.Error())
	}

	fullContent, err = project.GetFullContent()
	if err != nil {
		return "", "", errors.New("Failed to get paper full content: " + err.Error())
	}

	projectCategory, err := t.projectService.GetProjectCategory(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", errors.New("Failed to get paper category: " + err.Error())
	}

	err = t.toolCallRecordDB.CheckCoolDown(ctx, *t.Description.GetName(), actor.ID.Hex(), projectId, t.coolDownTime)
	if err != nil {
		return "", "", errors.New("CoolDown: " + err.Error())
	}

	return fullContent, projectCategory.Explanation, nil
}

func (t *PaperScoreCommentTool) execute(ctx context.Context, fullContent string, paperScoreResult *projectv1.PaperScoreResult) (
	paperScoreCommentResult *projectv1.PaperScoreCommentResult,
	comments []*projectv1.OverleafComment, err error) {
	resp, err := t.PaperScoreComment(fullContent, paperScoreResult)
	if err != nil {
		return nil, nil, errors.New("failed to get paper score comment: " + err.Error())
	}

	comments, err = t.reverseCommentService.ReverseComments(ctx, resp)
	if err != nil {
		return nil, nil, errors.New("failed to reverse comments: " + err.Error())
	}

	return resp, comments, nil
}

// unmarshalPaperScoreResult unmarshals the JSON string into a PaperScoreResult
func (t *PaperScoreCommentTool) unmarshalPaperScoreResult(data string) (*projectv1.PaperScoreResult, error) {
	var result projectv1.PaperScoreResult
	err := json.Unmarshal([]byte(data), &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (t *PaperScoreCommentTool) PaperScoreComment(latexSource string, paperScoreResult *projectv1.PaperScoreResult) (*projectv1.PaperScoreCommentResult, error) {
	reqBody := PaperScoreCommentRequest{
		LatexSource:      latexSource,
		PaperScoreResult: paperScoreResult,
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

	var scores projectv1.PaperScoreCommentResult
	err = json.Unmarshal(body, &scores)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response body: %w, body: %s", err, string(body))
	}

	return &scores, nil
}
