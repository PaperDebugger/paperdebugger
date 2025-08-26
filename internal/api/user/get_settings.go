package user

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) GetSettings(ctx context.Context, req *userv1.GetSettingsRequest) (*userv1.GetSettingsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, shared.ErrInvalidActor("user not authenticated")
	}

	userSettings, err := s.userService.GetUserSettings(ctx, actor.ID)
	if err != nil {
		s.logger.Error("Failed to get user settings", "error", err, "userID", actor.ID)
		return nil, shared.ErrInternal("failed to get user settings")
	}

	return &userv1.GetSettingsResponse{
		Settings: mapper.MapModelSettingsToProto(userSettings),
	}, nil
}
