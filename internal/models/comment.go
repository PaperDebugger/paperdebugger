package models

import (
	"go.mongodb.org/mongo-driver/v2/bson"
)

// The status of a comment in Overleaf
type CommentStatus int

const (
	CommentStatusNoAction CommentStatus = iota
	CommentStatusAccepted
	CommentStatusRejected
)

// The importance level of a comment
type ImportanceLevel string

const (
	ImportanceLevelCritical ImportanceLevel = "Critical"
	ImportanceLevelHigh     ImportanceLevel = "High"
	ImportanceLevelMedium   ImportanceLevel = "Medium"
	ImportanceLevelLow      ImportanceLevel = "Low"
	ImportanceLevelNone     ImportanceLevel = ""
)

type Comment struct {
	BaseModel         `bson:",inline"`
	UserID            bson.ObjectID   `bson:"user_id"`
	ProjectID         string          `bson:"project_id"`
	DocID             string          `bson:"doc_id"`
	DocVersion        int             `bson:"doc_version"`
	DocSHA1           string          `bson:"doc_sha1"`
	QuotePosition     int             `bson:"quote_position"`
	QuoteText         string          `bson:"quote_text"`
	Comment           string          `bson:"comment"`
	ImportanceLevel   ImportanceLevel `bson:"importance_level"`
	IsAddedToOverleaf CommentStatus   `bson:"is_added_to_overleaf"`
	DocPath           string          `bson:"doc_path"`
	Section           string          `bson:"section"`
}

func (c Comment) CollectionName() string {
	return "comments"
}
