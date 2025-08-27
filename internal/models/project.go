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
