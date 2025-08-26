package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"paperdebugger/internal/libs/jwt"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"
)

func (s *AuthServer) LoginByGoogle(
	ctx context.Context,
	req *authv1.LoginByGoogleRequest,
) (*authv1.LoginByGoogleResponse, error) {
	googleToken := req.GetGoogleToken()
	if googleToken == "" {
		return nil, shared.ErrInvalidCredential("google token is empty")
	}

	googleUserInfo, err := fetchGoogleUserInfo(ctx, googleToken)
	if err != nil {
		return nil, shared.ErrInvalidCredential(err)
	}

	if !googleUserInfo.VerifiedEmail {
		return nil, shared.ErrInvalidCredential("email not verified")
	}

	// Create default user with Google info
	user := &models.User{
		Email:     googleUserInfo.Email,
		Name:      googleUserInfo.Name,
		Picture:   googleUserInfo.Picture,
		LastLogin: bson.NewDateTimeFromTime(time.Now()),
	}

	user, err = s.userService.UpsertUserByEmail(ctx, user)
	if err != nil {
		return nil, err
	}

	token, err := jwt.SignJwtToken(user.ID.Hex())
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.tokenService.CreateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return &authv1.LoginByGoogleResponse{
		Token:        token,
		RefreshToken: refreshToken.Token,
	}, nil
}

type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

func fetchGoogleUserInfo(ctx context.Context, token string) (*GoogleUserInfo, error) {
	url := fmt.Sprintf("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=%s", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("invalid token, status code: %d, response: %s", resp.StatusCode, string(bodyBytes))
	}

	url = "https://www.googleapis.com/oauth2/v2/userinfo"
	req, err = http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", token))
	client = &http.Client{}
	resp, err = client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("invalid token, status code: %d, response: %s", resp.StatusCode, string(bodyBytes))
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %v", err)
	}

	return &userInfo, nil
}
