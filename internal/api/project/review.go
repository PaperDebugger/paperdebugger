package project

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
)

type paperScoreRequest struct {
	LatexSource string `json:"latexSource"`
	Category    string `json:"category"`
}

type paperScoreCommentRequest struct {
	LatexSource      string                      `json:"latexSource"`
	PaperScoreResult *projectv1.PaperScoreResult `json:"paperScoreResult"`
}

func (s *ProjectServer) RunProjectPaperScore(
	ctx context.Context,
	req *projectv1.RunProjectPaperScoreRequest,
) (*projectv1.RunProjectPaperScoreResponse, error) {
	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}

	ctx, fullContent, category, err := s.loadReviewInput(ctx, req.GetProjectId(), req.GetConversationId())
	if err != nil {
		return nil, err
	}

	result, err := s.scorePaper(ctx, fullContent, category)
	if err != nil {
		return nil, shared.ErrInternal(err)
	}

	return &projectv1.RunProjectPaperScoreResponse{
		ProjectId:  req.GetProjectId(),
		PaperScore: result,
	}, nil
}

func (s *ProjectServer) RunProjectPaperScoreComment(
	ctx context.Context,
	req *projectv1.RunProjectPaperScoreCommentRequest,
) (*projectv1.RunProjectPaperScoreCommentResponse, error) {
	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}

	ctx, fullContent, category, err := s.loadReviewInput(ctx, req.GetProjectId(), req.GetConversationId())
	if err != nil {
		return nil, err
	}

	scoreResult, err := s.scorePaper(ctx, fullContent, category)
	if err != nil {
		return nil, shared.ErrInternal(err)
	}

	commentResult, err := s.generatePaperScoreComments(ctx, fullContent, scoreResult)
	if err != nil {
		return nil, shared.ErrInternal(err)
	}

	return &projectv1.RunProjectPaperScoreCommentResponse{
		ProjectId: req.GetProjectId(),
		Comments:  []*projectv1.PaperScoreCommentResult{commentResult},
	}, nil
}

func (s *ProjectServer) RunProjectOverleafComment(
	ctx context.Context,
	req *projectv1.RunProjectOverleafCommentRequest,
) (*projectv1.RunProjectOverleafCommentResponse, error) {
	if req.GetProjectId() == "" {
		return nil, shared.ErrBadRequest("project_id is required")
	}
	if strings.TrimSpace(req.GetComment()) == "" {
		return nil, shared.ErrBadRequest("comment is required")
	}

	ctx, _, err := s.loadProject(ctx, req.GetProjectId())
	if err != nil {
		return nil, err
	}

	commentResult := &projectv1.PaperScoreCommentResult{
		Results: []*projectv1.PaperScoreCommentEntry{
			{
				Section:    req.GetSection(),
				AnchorText: req.GetAnchorText(),
				Weakness:   req.GetComment(),
				Importance: req.GetImportance(),
			},
		},
	}

	comments, err := s.reverseCommentService.ReverseComments(ctx, commentResult)
	if err != nil {
		return nil, shared.ErrInternal(err)
	}
	if len(comments) == 0 {
		section := strings.TrimSpace(req.GetSection())
		if section == "" {
			section = "the requested location"
		}
		return nil, shared.ErrBadRequest(fmt.Sprintf("unable to locate %s in the project for comment insertion", section))
	}

	return &projectv1.RunProjectOverleafCommentResponse{
		ProjectId: req.GetProjectId(),
		Comments:  comments,
	}, nil
}

func (s *ProjectServer) loadProject(ctx context.Context, projectID string) (context.Context, *models.Project, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return ctx, nil, err
	}

	ctx = contextutil.SetProjectID(ctx, projectID)

	project, err := s.projectService.GetProject(ctx, actor.ID, projectID)
	if err != nil {
		return ctx, nil, err
	}

	return ctx, project, nil
}

func (s *ProjectServer) loadReviewInput(ctx context.Context, projectID string, conversationID string) (context.Context, string, string, error) {
	ctx, project, err := s.loadProject(ctx, projectID)
	if err != nil {
		return ctx, "", "", err
	}

	if conversationID != "" {
		ctx = contextutil.SetConversationID(ctx, conversationID)
	}

	fullContent, err := project.GetFullContent()
	if err != nil {
		return ctx, "", "", shared.ErrInternal("failed to get paper full content")
	}

	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return ctx, "", "", err
	}

	projectCategory, err := s.projectService.GetProjectCategory(ctx, actor.ID, projectID)
	if err != nil {
		return ctx, "", "", shared.ErrInternal(err)
	}

	return ctx, fullContent, projectCategory.Category, nil
}

func (s *ProjectServer) scorePaper(ctx context.Context, fullContent string, category string) (*projectv1.PaperScoreResult, error) {
	result := &projectv1.PaperScoreResult{}
	err := s.postReviewJSON(ctx, "paper-score", &paperScoreRequest{
		LatexSource: fullContent,
		Category:    category,
	}, result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *ProjectServer) generatePaperScoreComments(
	ctx context.Context,
	fullContent string,
	scoreResult *projectv1.PaperScoreResult,
) (*projectv1.PaperScoreCommentResult, error) {
	result := &projectv1.PaperScoreCommentResult{}
	err := s.postReviewJSON(ctx, "paper-score-comments", &paperScoreCommentRequest{
		LatexSource:      fullContent,
		PaperScoreResult: scoreResult,
	}, result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *ProjectServer) postReviewJSON(ctx context.Context, path string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal review request: %w", err)
	}

	url := strings.TrimRight(s.cfg.MCPServerURL, "/") + "/" + strings.TrimLeft(path, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create review request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return fmt.Errorf("failed to send review request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read review response: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("review service returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("failed to decode review response: %w", err)
	}

	return nil
}
