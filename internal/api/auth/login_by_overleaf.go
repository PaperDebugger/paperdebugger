package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"paperdebugger/internal/libs/jwt"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	authv1 "paperdebugger/pkg/gen/api/auth/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func (s *AuthServer) LoginByOverleaf(
	ctx context.Context,
	req *authv1.LoginByOverleafRequest,
) (*authv1.LoginByOverleafResponse, error) {
	overleafSession2 := req.GetOverleafToken()
	if overleafSession2 == "" {
		return nil, shared.ErrInvalidCredential("overleaf token is empty")
	}

	overleafUserInfo, err := fetchOverleafUserInfo(ctx, overleafSession2)
	if err != nil {
		return nil, shared.ErrInvalidCredential(err)
	}

	// Create default user with Google info
	user := &models.User{
		Email:     overleafUserInfo.Email,
		Name:      overleafUserInfo.FirstName + " " + overleafUserInfo.LastName,
		Picture:   "",
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

	return &authv1.LoginByOverleafResponse{
		Token:        token,
		RefreshToken: refreshToken.Token,
	}, nil
}

type OverleafUserInfo struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func fetchOverleafUserInfo(ctx context.Context, token string) (*OverleafUserInfo, error) {
	url := "https://www.overleaf.com/user/settings"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Add("Cookie", fmt.Sprintf("overleaf_session2=%s", token))
	req.Header.Add("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15")
	req.Header.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Add("Accept-Language", "zh-SG,zh-CN;q=0.9,zh-Hans;q=0.8")
	req.Header.Add("Referer", "https://www.overleaf.com/project")

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

	bodyBytes, _ := io.ReadAll(resp.Body)
	body := string(bodyBytes)

	match := regexp.MustCompile(`<meta name="ol-user" [^>]*content="([^"]+)">`).FindStringSubmatch(body)
	if len(match) < 2 {
		return nil, fmt.Errorf("ol-user not found")
	}

	// replace all &quot; with "
	jsonStr := strings.ReplaceAll(match[1], "&quot;", "\"")

	var userInfo OverleafUserInfo
	if err := json.Unmarshal([]byte(jsonStr), &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %v", err)
	}
	return &userInfo, nil
}
