package models

import "go.mongodb.org/mongo-driver/v2/bson"

type CustomModel struct {
	ID            bson.ObjectID `bson:"_id"`
	Name          string        `bson:"name"`
	BaseUrl       string        `bson:"base_url"`
	Slug          string        `bson:"slug"`
	APIKey        string        `bson:"api_key"`
	ContextWindow int32         `bson:"context_window"`
	MaxOutput     int32         `bson:"max_output"`
	InputPrice    int32         `bson:"input_price"`
	OutputPrice   int32         `bson:"output_price"`
}

type Settings struct {
	ShowShortcutsAfterSelection  bool          `bson:"show_shortcuts_after_selection"`
	FullWidthPaperDebuggerButton bool          `bson:"full_width_paper_debugger_button"`
	EnableCompletion             bool          `bson:"enable_completion"`
	FullDocumentRag              bool          `bson:"full_document_rag"`
	ShowedOnboarding             bool          `bson:"showed_onboarding"`
	OpenAIAPIKey                 string        `bson:"openai_api_key"`
	CustomModels                 []CustomModel `bson:"custom_models"`
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
