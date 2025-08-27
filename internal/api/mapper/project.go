package mapper

import (
	"paperdebugger/internal/models"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func MapModelProjectDocToProto(doc models.ProjectDoc) *projectv1.ProjectDoc {
	return &projectv1.ProjectDoc{
		Id:       doc.ID,
		Version:  int32(doc.Version),
		Filepath: doc.Filepath,
		Lines:    doc.Lines,
	}
}

func MapProtoProjectDocToModel(doc *projectv1.ProjectDoc) models.ProjectDoc {
	return models.ProjectDoc{
		ID:       doc.Id,
		Version:  int(doc.Version),
		Filepath: doc.Filepath,
		Lines:    doc.Lines,
	}
}

func MapModelProjectToProto(project *models.Project) *projectv1.Project {
	return &projectv1.Project{
		Id:        project.ProjectID,
		CreatedAt: timestamppb.New(project.CreatedAt.Time()),
		UpdatedAt: timestamppb.New(project.UpdatedAt.Time()),
		Name:      project.Name,
		RootDocId: project.RootDocID,
		// Do not map docs here, user should get docs from the "websocket sync"
	}
}
