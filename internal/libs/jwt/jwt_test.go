package jwt

import (
	"os"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func init() {
	os.Setenv("JWT_SIGNING_KEY", "1234567890")
}

func TestVerifyJwtToken(t *testing.T) {
	userID := uuid.New().String()
	token, err := SignJwtToken(userID)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := VerifyJwtToken(token)
	assert.NoError(t, err)
	assert.Equal(t, userID, claims.Subject)
}

func TestVerifyJwtToken_InvalidToken(t *testing.T) {
	userID := uuid.New().String()
	token, err := SignJwtToken(userID)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := VerifyJwtToken("Not-a-valid-token")
	assert.Error(t, err)
	assert.Equal(t, jwt.RegisteredClaims{}, claims)
}
