package mapper

import (
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func MapProtoSettingsToModel(settings *userv1.Settings) *models.Settings {
	return &models.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCitationSuggestion:             settings.EnableCitationSuggestion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
		OpenAIAPIKey:                 settings.OpenaiApiKey,
	}
}

func MapModelSettingsToProto(settings *models.Settings) *userv1.Settings {
	return &userv1.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCitationSuggestion:             settings.EnableCitationSuggestion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
		OpenaiApiKey:                 settings.OpenAIAPIKey,
	}
}
