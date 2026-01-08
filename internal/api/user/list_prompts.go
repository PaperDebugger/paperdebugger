package user

import (
	"context"
	"sort"
	"time"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	userv1 "paperdebugger/pkg/gen/api/user/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var defaultPrompts = []*userv1.Prompt{
	// {
	// 	Id:           "1",
	// 	CreatedAt:    timestamppb.New(time.Time{}),
	// 	UpdatedAt:    timestamppb.New(time.Time{}),
	// 	Title:        "Enhance Academic Writing (Powered by XtraGPT)",
	// 	Content:      "Suggest context-aware academic paper writing enhancements for the selected text.",
	// 	IsUserPrompt: false,
	// },
	{
		Id:           "2",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Search Relevant Papers (Powered by XtraMCP)",
		Content:      "First, understand my paper and extract the key ideas into an optimized query to find papers that are relevant to my work. Then search for relevant papers to read.\n\nOptional Args:\ntop_k: 10\nStart Date: None (e.g. 2018-12-31)\nEnd Date: None (e.g. 2025-12-31)",
		IsUserPrompt: false,
	},
	{
		Id:           "3",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Paper Review (Powered by XtraMCP)",
		Content:      "Call review_paper and evaluate my paper.\n\nOptional Args:\nTarget Venue: None (e.g. ICML, NeurIPS, CVPR)\nSeverity Level (blocker | major | minor | nit): Major\nSpecific Sections (default: entire paper): None (e.g. Abstract, Results, <section name in paper>)",
		IsUserPrompt: false,
	},
	{
		Id:           "4",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Verify Citations (Powered by XtraMCP)",
		Content:      "Call verify_citations to check the validity of all citations in my paper and identify any potential issues such as incorrect formatting, missing information, or inaccurate references.",
		IsUserPrompt: false,
	},
	{
		Id:           "5",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Deep Research (Powered by XtraMCP)",
		Content:      "First, understand my paper and extract the key ideas into an optimized query. Do deep research and compare my paper against others.",
		IsUserPrompt: false,
	},
	{
		Id:           "6",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Online Research (Powered by XtraMCP)",
		Content:      "Understand my paper and run online search to find the latest papers related to my work.",
		IsUserPrompt: false,
	},
}

func (s *UserServer) ListPrompts(
	ctx context.Context,
	req *userv1.ListPromptsRequest,
) (*userv1.ListPromptsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	prompts, err := s.promptService.ListPrompts(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	// Get user prompts
	userPrompts := mapper.MapModelPromptsToProto(prompts)

	// Sort user prompts by UpdatedAt in descending order
	sort.Slice(userPrompts, func(i, j int) bool {
		return userPrompts[i].UpdatedAt.AsTime().After(userPrompts[j].UpdatedAt.AsTime())
	})

	// Append default prompts after sorted user prompts
	allPrompts := append(userPrompts, defaultPrompts...)

	return &userv1.ListPromptsResponse{
		Prompts: allPrompts,
	}, nil
}
