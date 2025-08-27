package user

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) ResetSettings(ctx context.Context, req *userv1.ResetSettingsRequest) (*userv1.ResetSettingsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	resetSettings, err := s.userService.ResetUserSettings(ctx, actor.ID)
	if err != nil {
		s.logger.Error("Failed to reset user settings", "error", err, "userID", actor.ID)
		return nil, status.Error(codes.Internal, "failed to reset user settings")
	}

	return &userv1.ResetSettingsResponse{
		Settings: mapper.MapModelSettingsToProto(resetSettings),
	}, nil
}
