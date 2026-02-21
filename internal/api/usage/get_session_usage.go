package usage

import (
	"context"

	"paperdebugger/internal/libs/contextutil"
	usagev1 "paperdebugger/pkg/gen/api/usage/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func (s *UsageServer) GetSessionUsage(
	ctx context.Context,
	req *usagev1.GetSessionUsageRequest,
) (*usagev1.GetSessionUsageResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	session, err := s.usageService.GetActiveSession(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	if session == nil {
		return &usagev1.GetSessionUsageResponse{
			Session: nil,
		}, nil
	}

	return &usagev1.GetSessionUsageResponse{
		Session: &usagev1.SessionUsage{
			SessionExpiry: timestamppb.New(session.SessionExpiry.Time()),
			TotalTokens:   session.TotalTokens,
		},
	}, nil
}
