package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ProjectService struct {
	BaseService
	projectCollection *mongo.Collection
}

type ClassifyPaperRequest struct {
	LatexSource string `json:"latexSource"`
}

func NewProjectService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *ProjectService {
	base := NewBaseService(db, cfg, logger)
	return &ProjectService{
		BaseService:       base,
		projectCollection: base.db.Collection((models.Project{}).CollectionName()),
	}
}

func (s *ProjectService) UpsertProject(ctx context.Context, userID bson.ObjectID, projectID string, project *models.Project) (*models.Project, error) {
	existingProject, err := s.GetProject(ctx, userID, projectID)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, err
	}

	if err == mongo.ErrNoDocuments {
		project.ID = bson.NewObjectID()
		project.CreatedAt = bson.NewDateTimeFromTime(time.Now())
		project.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
		project.ProjectID = projectID
		project.UserID = userID
		_, err := s.projectCollection.InsertOne(ctx, project)
		if err != nil {
			return nil, err
		}
		return project, nil
	} else {
		for _, doc := range project.Docs {
			for _, existingDoc := range existingProject.Docs {
				if existingDoc.ID == doc.ID && existingDoc.Version > doc.Version {
					return nil, errors.New("doc version is less than existing doc version")
				}
			}
		}

		project.ID = existingProject.ID
		project.CreatedAt = existingProject.CreatedAt
		project.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
		project.ProjectID = existingProject.ProjectID
		project.UserID = existingProject.UserID
		_, err := s.projectCollection.UpdateOne(ctx, bson.M{"_id": existingProject.ID}, bson.M{"$set": project})
		if err != nil {
			return nil, err
		}
		return project, nil
	}
}

func (s *ProjectService) GetProject(ctx context.Context, userID bson.ObjectID, projectID string) (*models.Project, error) {
	result := s.projectCollection.FindOne(ctx, bson.M{"user_id": userID, "project_id": projectID})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var project models.Project
	if err := result.Decode(&project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (s *ProjectService) UpdateProjectCategory(ctx context.Context, userID bson.ObjectID, projectID string, category models.ClassifyPaperResponse) error {
	filter := bson.M{"user_id": userID, "project_id": projectID}
	update := bson.M{
		"$set": bson.M{
			"category":   category,
			"updated_at": bson.NewDateTimeFromTime(time.Now()),
		},
	}

	result, err := s.projectCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}

func (s *ProjectService) GetProjectCategory(ctx context.Context, userID bson.ObjectID, projectID string) (models.ClassifyPaperResponse, error) {
	project, err := s.GetProject(ctx, userID, projectID)
	if err != nil {
		return models.ClassifyPaperResponse{}, err
	}

	if project.Category.Category != "" {
		return project.Category, nil
	}

	fullContent, err := project.GetFullContent()
	if err != nil {
		return models.ClassifyPaperResponse{}, fmt.Errorf("failed to get full content: %w", err)
	}

	category, err := s.fetchCategoryFromAPI(fullContent)
	if err != nil {
		return models.ClassifyPaperResponse{}, fmt.Errorf("failed to fetch category from API: %w", err)
	}

	err = s.UpdateProjectCategory(ctx, userID, projectID, *category)
	if err != nil {
		s.logger.Error("failed to update project category in database", "error", err)
		// Do not return error here, just log it
	}

	return *category, nil
}

func (s *ProjectService) fetchCategoryFromAPI(latexSource string) (*models.ClassifyPaperResponse, error) {
	reqBody := ClassifyPaperRequest{
		LatexSource: latexSource,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", "http://paperdebugger-mcp-server:8000/classify-paper", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status code: %d", resp.StatusCode)
	}

	var response models.ClassifyPaperResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

func (s *ProjectService) GetProjectInstructions(ctx context.Context, userID bson.ObjectID, projectID string) (string, error) {
	project, err := s.GetProject(ctx, userID, projectID)
	if err != nil {
		return "", err
	}
	return project.Instructions, nil
}

func (s *ProjectService) UpsertProjectInstructions(ctx context.Context, userID bson.ObjectID, projectID string, instructions string) (string, error) {
	filter := bson.M{"user_id": userID, "project_id": projectID}
	update := bson.M{
		"$set": bson.M{
			"instructions": instructions,
			"updated_at":   bson.NewDateTimeFromTime(time.Now()),
		},
	}

	result, err := s.projectCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return "", err
	}

	if result.MatchedCount == 0 {
		return "", mongo.ErrNoDocuments
	}

	return instructions, nil
}
