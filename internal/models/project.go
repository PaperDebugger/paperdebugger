package models

import (
	"strings"
	"time"

	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/libs/tex"

	"github.com/samber/lo"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type ProjectDoc struct {
	ID       string   `bson:"id"`
	Version  int      `bson:"version"`
	Filepath string   `bson:"filepath"`
	Lines    []string `bson:"lines"`
}

type ClassifyPaperResponse struct {
	Category    string `bson:"category"`
	Confidence  int    `bson:"confidence"`
	Explanation string `bson:"explanation"`
}

type Project struct {
	BaseModel    `bson:",inline"`
	UserID       bson.ObjectID         `bson:"user_id"`
	ProjectID    string                `bson:"project_id"`
	Name         string                `bson:"name"`
	RootDocID    string                `bson:"root_doc_id"`
	Docs         []ProjectDoc          `bson:"docs"`
	Category     ClassifyPaperResponse `bson:"category,omitempty"`
	Instructions string                `bson:"instructions"`
}

func (u Project) CollectionName() string {
	return "projects"
}

func (u *Project) GetFullContent() (string, error) {
	docs := make(map[string]string)
	for _, doc := range u.Docs {
		docs[doc.Filepath] = strings.Join(doc.Lines, "\n")
	}
	rootDoc, ok := lo.Find(u.Docs, func(doc ProjectDoc) bool {
		return doc.ID == u.RootDocID
	})
	if !ok {
		return "", shared.ErrInternal("root doc not found")
	}
	return tex.Latexpand(docs, rootDoc.Filepath)
}

func (u *Project) IsOutOfDate() bool {
	return u.UpdatedAt.Time().Before(time.Now().Add(-time.Minute * 30))
}

// ProjectFolder represents a folder in the project hierarchy (v2)
type ProjectFolder struct {
	ID      string          `bson:"id"`
	Name    string          `bson:"name"`
	Docs    []ProjectDoc    `bson:"docs"`
	Folders []ProjectFolder `bson:"folders"`
}

// ProjectV2 represents a project with hierarchical folder structure
type ProjectV2 struct {
	BaseModel    `bson:",inline"`
	UserID       bson.ObjectID         `bson:"user_id"`
	ProjectID    string                `bson:"project_id"`
	Name         string                `bson:"name"`
	RootDocID    string                `bson:"root_doc_id"`
	RootFolder   *ProjectFolder        `bson:"root_folder"`
	Instructions string                `bson:"instructions"`
	Category     ClassifyPaperResponse `bson:"category,omitempty"`
}

func (u ProjectV2) CollectionName() string {
	return "projects"
}

// collectDocs recursively collects all documents from the folder tree
func (u *ProjectV2) collectDocs(folder *ProjectFolder, docs map[string]string) {
	if folder == nil {
		return
	}
	for _, doc := range folder.Docs {
		docs[doc.Filepath] = strings.Join(doc.Lines, "\n")
	}
	for i := range folder.Folders {
		u.collectDocs(&folder.Folders[i], docs)
	}
}

// findRootDoc finds the root document in the folder tree
func (u *ProjectV2) findRootDoc(folder *ProjectFolder) *ProjectDoc {
	if folder == nil {
		return nil
	}
	for i := range folder.Docs {
		if folder.Docs[i].ID == u.RootDocID {
			return &folder.Docs[i]
		}
	}
	for i := range folder.Folders {
		if doc := u.findRootDoc(&folder.Folders[i]); doc != nil {
			return doc
		}
	}
	return nil
}

func (u *ProjectV2) GetFullContent() (string, error) {
	docs := make(map[string]string)
	u.collectDocs(u.RootFolder, docs)

	rootDoc := u.findRootDoc(u.RootFolder)
	if rootDoc == nil {
		return "", shared.ErrInternal("root doc not found")
	}
	return tex.Latexpand(docs, rootDoc.Filepath)
}

func (u *ProjectV2) IsOutOfDate() bool {
	return u.UpdatedAt.Time().Before(time.Now().Add(-time.Minute * 30))
}
