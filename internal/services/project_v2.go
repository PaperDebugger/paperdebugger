package services

import (
	"context"
	"errors"
	"time"

	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// GetProjectV2 retrieves a project with v2 structure
func (s *ProjectService) GetProjectV2(ctx context.Context, userID bson.ObjectID, projectID string) (*models.ProjectV2, error) {
	result := s.projectCollection.FindOne(ctx, bson.M{"user_id": userID, "project_id": projectID})
	if result.Err() != nil {
		return nil, result.Err()
	}

	var project models.ProjectV2
	if err := result.Decode(&project); err != nil {
		return nil, err
	}

	return &project, nil
}

// UpsertProjectV2 creates or updates a project with v2 structure
func (s *ProjectService) UpsertProjectV2(ctx context.Context, userID bson.ObjectID, projectID string, project *models.ProjectV2) (*models.ProjectV2, error) {
	existingProject, err := s.GetProjectV2(ctx, userID, projectID)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, err
	}

	if err == mongo.ErrNoDocuments {
		// Create new project
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
	}

	// Update existing project - check version conflicts
	if err := s.checkVersionConflicts(project.RootFolder, existingProject.RootFolder); err != nil {
		return nil, err
	}

	// Preserve metadata
	project.ID = existingProject.ID
	project.CreatedAt = existingProject.CreatedAt
	project.UpdatedAt = bson.NewDateTimeFromTime(time.Now())
	project.ProjectID = existingProject.ProjectID
	project.UserID = existingProject.UserID

	// Full replacement update
	_, err = s.projectCollection.UpdateOne(ctx, bson.M{"_id": existingProject.ID}, bson.M{"$set": project})
	if err != nil {
		return nil, err
	}

	return project, nil
}

// checkVersionConflicts recursively checks for version conflicts in the folder tree
func (s *ProjectService) checkVersionConflicts(newFolder, existingFolder *models.ProjectFolder) error {
	if newFolder == nil || existingFolder == nil {
		return nil
	}

	// Build a map of existing documents for quick lookup
	existingDocs := s.flattenDocs(existingFolder)

	// Check all new documents against existing versions
	newDocs := s.flattenDocs(newFolder)
	for docID, newDoc := range newDocs {
		if existingDoc, ok := existingDocs[docID]; ok {
			if existingDoc.Version > newDoc.Version {
				return errors.New("doc version is less than existing doc version")
			}
		}
	}

	return nil
}

// flattenDocs recursively flattens all documents in a folder tree into a map
func (s *ProjectService) flattenDocs(folder *models.ProjectFolder) map[string]models.ProjectDoc {
	docs := make(map[string]models.ProjectDoc)
	if folder == nil {
		return docs
	}

	s.collectDocsFromFolder(folder, docs)
	return docs
}

// collectDocsFromFolder is a helper that recursively collects documents
func (s *ProjectService) collectDocsFromFolder(folder *models.ProjectFolder, docs map[string]models.ProjectDoc) {
	if folder == nil {
		return
	}

	for _, doc := range folder.Docs {
		docs[doc.ID] = doc
	}

	for i := range folder.Folders {
		s.collectDocsFromFolder(&folder.Folders[i], docs)
	}
}
