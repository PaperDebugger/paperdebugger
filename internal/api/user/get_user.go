package user

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func (s *UserServer) GetUser(
	ctx context.Context,
	req *userv1.GetUserRequest,
) (*userv1.GetUserResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	user, err := s.userService.GetUserByID(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	return &userv1.GetUserResponse{
		User: &userv1.User{
			Id:      user.ID.Hex(),
			Email:   user.Email,
			Name:    user.Name,
			Picture: user.Picture,
		},
	}, nil
}
