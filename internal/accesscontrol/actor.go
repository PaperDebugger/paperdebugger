package accesscontrol

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"paperdebugger/internal/libs/jwt"
	apperrors "paperdebugger/internal/libs/errors"
)

type Actor struct {
	ID bson.ObjectID
}

// UserExistenceChecker is a function type that verifies if a user exists by their ID.
// It returns an error if the user does not exist or if the check fails.
type UserExistenceChecker func(ctx context.Context, userID bson.ObjectID) error

// ParseUserActor parses and validates a JWT token to extract the user actor.
// It verifies the token, checks the audience claim, and validates that the user exists.
func ParseUserActor(ctx context.Context, token string, checkUserExists UserExistenceChecker) (*Actor, error) {
	if len(token) == 0 {
		return nil, apperrors.ErrInvalidToken()
	}

	claims, err := jwt.VerifyJwtToken(token)
	if err != nil {
		return nil, apperrors.ErrInvalidToken(err)
	}

	if len(claims.Audience) == 0 || claims.Audience[0] != "paperdebugger/user" {
		return nil, apperrors.ErrInvalidActor()
	}

	actorID, err := bson.ObjectIDFromHex(claims.Subject)
	if err != nil {
		return nil, apperrors.ErrInvalidActor()
	}

	if err := checkUserExists(ctx, actorID); err != nil {
		return nil, apperrors.ErrInvalidUser(err)
	}

	return &Actor{ID: actorID}, nil
}
