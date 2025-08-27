package toolkit

import (
	"context"
	"paperdebugger/internal/accesscontrol"
	"paperdebugger/internal/libs/contextutil"
)

// Always return the actor, project id, and conversation id from context.
// If any of them is not found, return an empty string.
func GetActorProjectConversationID(ctx context.Context) (*accesscontrol.Actor, string, string) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, "", ""
	}

	projectId, err := contextutil.GetProjectID(ctx)
	if err != nil {
		return actor, "", ""
	}

	conversationID, err := contextutil.GetConversationID(ctx)
	if err != nil {
		return actor, projectId, ""
	}

	return actor, projectId, conversationID
}
