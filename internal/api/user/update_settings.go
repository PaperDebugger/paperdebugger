package user

import (
	"context"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

// UpdateSettings implements the UpdateSettings RPC from the UserService
func (s *UserServer) UpdateSettings(ctx context.Context, req *userv1.UpdateSettingsRequest) (*userv1.UpdateSettingsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, shared.ErrInvalidActor("user not authenticated")
	}

	modelSettings := mapper.MapProtoSettingsToModel(req.GetSettings())
	updatedSettings, err := s.userService.UpdateUserSettings(ctx, actor.ID, *modelSettings)
	if err != nil {
		s.logger.Error("Failed to update user settings", "error", err, "userID", actor.ID)
		return nil, shared.ErrInternal("failed to update user settings")
	}

	return &userv1.UpdateSettingsResponse{
		Settings: mapper.MapModelSettingsToProto(updatedSettings),
	}, nil
}
