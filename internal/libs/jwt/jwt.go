package jwt

import (
	"time"

	"paperdebugger/internal/libs/cfg"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func SignJwtToken(userID string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := jwt.RegisteredClaims{
		ID:        bson.NewObjectID().Hex(),
		ExpiresAt: jwt.NewNumericDate(expirationTime),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "PaperDebugger",
		Subject:   userID,
		Audience:  []string{"paperdebugger/user"},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(cfg.GetCfg().JwtSigningKey))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func VerifyJwtToken(token string) (jwt.RegisteredClaims, error) {
	claims := jwt.RegisteredClaims{}
	parsedToken, err := jwt.ParseWithClaims(token, &claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.GetCfg().JwtSigningKey), nil
	})

	if err != nil {
		return jwt.RegisteredClaims{}, err
	}

	if !parsedToken.Valid {
		return jwt.RegisteredClaims{}, jwt.ErrSignatureInvalid
	}

	return claims, nil
}
