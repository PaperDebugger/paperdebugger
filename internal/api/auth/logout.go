package auth

import (
	"context"

	authv1 "paperdebugger/pkg/gen/api/auth/v1"
)

func (s *AuthServer) Logout(
	ctx context.Context, req *authv1.LogoutRequest,
) (*authv1.LogoutResponse, error) {
	token, err := s.tokenService.GetTokenByToken(ctx, req.GetRefreshToken())
	if err != nil {
		return nil, err
	}

	err = s.tokenService.DeleteToken(ctx, token)
	if err != nil {
		return nil, err
	}

	return &authv1.LogoutResponse{}, nil
}
