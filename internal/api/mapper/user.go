package mapper

import (
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func MapProtoSettingsToModel(settings *userv1.Settings) *models.Settings {
	return &models.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCompletion:             settings.EnableCompletion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
	}
}

func MapModelSettingsToProto(settings *models.Settings) *userv1.Settings {
	return &userv1.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCompletion:             settings.EnableCompletion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
	}
}
