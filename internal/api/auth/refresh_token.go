package auth

import (
	"context"
	"time"

	"paperdebugger/internal/libs/jwt"
	"paperdebugger/internal/libs/shared"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func (s *AuthServer) RefreshToken(ctx context.Context, req *authv1.RefreshTokenRequest) (*authv1.RefreshTokenResponse, error) {
	token, err := s.tokenService.GetTokenByToken(ctx, req.RefreshToken)
	if err == mongo.ErrNoDocuments {
		return nil, shared.ErrInvalidToken()
	}
	if err != nil {
		return nil, err
	}

	if token.Type != "refreshToken" || token.ExpiresAt.Before(time.Now()) {
		return nil, shared.ErrInvalidToken()
	}

	token.Token = bson.NewObjectID().Hex()
	token.ExpiresAt = time.Now().Add(time.Hour * 24 * 30)
	newJwtToken, err := jwt.SignJwtToken(token.UserID.Hex())
	if err != nil {
		return nil, err
	}
	newRefreshToken, err := s.tokenService.UpdateToken(ctx, token)
	if err != nil {
		return nil, err
	}

	return &authv1.RefreshTokenResponse{
		Token:        newJwtToken,
		RefreshToken: newRefreshToken.Token,
	}, nil
}
