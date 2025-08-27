package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Settings struct {
	ShowShortcutsAfterSelection  bool `bson:"show_shortcuts_after_selection"`
	FullWidthPaperDebuggerButton bool `bson:"full_width_paper_debugger_button"`
	EnableCompletion             bool `bson:"enable_completion"`
	FullDocumentRag              bool `bson:"full_document_rag"`
	ShowedOnboarding             bool `bson:"showed_onboarding"`
}

type User struct {
	BaseModel    `bson:",inline"`
	Email        string        `bson:"email,unique"`
	Name         string        `bson:"name"`
	Picture      string        `bson:"picture"`
	LastLogin    bson.DateTime `bson:"last_login"`
	Settings     Settings      `bson:"settings"`
	Instructions string        `bson:"instructions"`
}

func (u User) CollectionName() string {
	return "users"
}
