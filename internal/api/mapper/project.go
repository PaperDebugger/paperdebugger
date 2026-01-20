package mapper

import (
	"paperdebugger/internal/models"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	projectv2 "paperdebugger/pkg/gen/api/project/v2"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// V1 Mappers
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

// V2 Mappers
func MapModelProjectDocToProtoV2(doc models.ProjectDoc) *projectv2.ProjectDoc {
	return &projectv2.ProjectDoc{
		Id:       doc.ID,
		Version:  int32(doc.Version),
		Filename: extractFilename(doc.Filepath),
		Filepath: doc.Filepath,
		Lines:    doc.Lines,
	}
}

func MapProtoProjectDocToModelV2(doc *projectv2.ProjectDoc) models.ProjectDoc {
	return models.ProjectDoc{
		ID:       doc.Id,
		Version:  int(doc.Version),
		Filepath: doc.Filepath,
		Lines:    doc.Lines,
	}
}

func MapModelProjectFolderToProto(folder *models.ProjectFolder) *projectv2.ProjectFolder {
	if folder == nil {
		return nil
	}

	protoDocs := make([]*projectv2.ProjectDoc, len(folder.Docs))
	for i, doc := range folder.Docs {
		protoDocs[i] = MapModelProjectDocToProtoV2(doc)
	}

	protoFolders := make([]*projectv2.ProjectFolder, len(folder.Folders))
	for i := range folder.Folders {
		protoFolders[i] = MapModelProjectFolderToProto(&folder.Folders[i])
	}

	return &projectv2.ProjectFolder{
		Id:      folder.ID,
		Name:    folder.Name,
		Docs:    protoDocs,
		Folders: protoFolders,
	}
}

func MapProtoProjectFolderToModel(folder *projectv2.ProjectFolder) *models.ProjectFolder {
	if folder == nil {
		return nil
	}

	modelDocs := make([]models.ProjectDoc, len(folder.Docs))
	for i, doc := range folder.Docs {
		modelDocs[i] = MapProtoProjectDocToModelV2(doc)
	}

	modelFolders := make([]models.ProjectFolder, len(folder.Folders))
	for i, subFolder := range folder.Folders {
		if mapped := MapProtoProjectFolderToModel(subFolder); mapped != nil {
			modelFolders[i] = *mapped
		}
	}

	return &models.ProjectFolder{
		ID:      folder.Id,
		Name:    folder.Name,
		Docs:    modelDocs,
		Folders: modelFolders,
	}
}

func MapModelProjectToProtoV2(project *models.ProjectV2) *projectv2.Project {
	return &projectv2.Project{
		Id:           project.ProjectID,
		CreatedAt:    timestamppb.New(project.CreatedAt.Time()),
		UpdatedAt:    timestamppb.New(project.UpdatedAt.Time()),
		Name:         project.Name,
		RootDocId:    project.RootDocID,
		RootFolder:   MapModelProjectFolderToProto(project.RootFolder),
		Instructions: project.Instructions,
	}
}

func MapProtoProjectToModelV2(proto *projectv2.Project) *models.ProjectV2 {
	return &models.ProjectV2{
		ProjectID:    proto.Id,
		Name:         proto.Name,
		RootDocID:    proto.RootDocId,
		RootFolder:   MapProtoProjectFolderToModel(proto.RootFolder),
		Instructions: proto.Instructions,
	}
}

// Helper function to extract filename from filepath
func extractFilename(filepath string) string {
	// Extract filename from filepath (e.g., "sections/intro.tex" -> "intro.tex")
	for i := len(filepath) - 1; i >= 0; i-- {
		if filepath[i] == '/' || filepath[i] == '\\' {
			return filepath[i+1:]
		}
	}
	return filepath
}
