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
	{
		Id:           "1",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Tool List",
		Content:      "List available MCP tools with a brief description for each tool.",
		IsUserPrompt: false,
	},
	{
		Id:           "2",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Search Relevant Papers (XtraMCP's Researcher)",
		Content:      "You are a research assistant helping to retrieve related academic papers.\n\nStep 1 — Query synthesis:\nCarefully read the provided paper content.\nExtract the core technical ideas, methods, problem setting, and application domain.\nProduce ONE concise, high-signal search query optimized for academic paper retrieval.\n- Prefer technical keywords and established terminology\n- Include model names, task names, or methodological frameworks when applicable\n- Avoid unnecessary elaboration, prose, or citations\n\nStep 2 — Tool invocation:\nCall `search_relevant_papers` using the synthesized query.\n\nTool parameters:\n- query: <your synthesized query>\n- top_k: 10\n- start_date: 2018-12-31\n- end_date: 2025-12-31",
		IsUserPrompt: false,
	},
	{
		Id:           "3",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Paper Review (XtraMCP's Reviewer)",
		Content:      "Call `review_paper` and evaluate my paper.\n\nTool parameters:\nTarget Venue: None (e.g. ICML, NeurIPS, CVPR)\nSeverity Level (blocker | major | minor | nit): Major\nSpecific Sections (default: entire paper): None (e.g. Abstract, Results, <section name in paper>)",
		IsUserPrompt: false,
	},
	{
		Id:           "4",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Verify Citations (XtraMCP's Reviewer)",
		Content:      "Call `verify_citations` to check the validity of all citations in my paper and identify any potential issues such as incorrect formatting, missing information, or inaccurate references.",
		IsUserPrompt: false,
	},
	{
		Id:           "5",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Generate Citations (XtraMCP's Reviewer)",
		Content:      "Call `generate_citations` to create properly formatted citations for my paper based on the provided references.\n\nTool parameters:\n- links: [\n\t# paste URLs, arXiv IDs, DOIs, or titles\n\t# eg.: XtraGPT: Context-Aware and Controllable Academic Paper Revision\n\t...\n]",
		IsUserPrompt: false,
	},
	{
		Id:           "6",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Deep Research (XtraMCP's Researcher)",
		Content:      "You are a research assistant helping to retrieve related academic papers to prepare for Deep Research.\n\nStep 1 — Query synthesis:\nCarefully read the provided paper content.\nExtract the core technical ideas, methods, problem setting, and application domain.\nProduce ONE concise, high-signal search query optimized for academic paper retrieval.\n- Prefer technical keywords and established terminology\n- Include model names, task names, or methodological frameworks when applicable\n- Avoid unnecessary elaboration, prose, or citations\n\nStep 2 — Tool invocation:\nCall `deep_research` using the synthesized query.\n\nTool parameters:\n- query: <your synthesized query>",
		IsUserPrompt: false,
	},
	{
		Id:           "7",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Online Research (XtraMCP's Researcher)",
		Content:      "You are a research assistant assisting with a recency-focused academic literature search.\n\nStep 1 — Keyword extraction:\nCarefully read the paper and extract a set of high-recall search keywords, including:\n- core task names and problem statements\n- methodological approaches and system types\n- application domains\n- commonly used synonyms and alternative phrasings\n- well-known model or framework names if relevant and widely used\n\nPrefer established terminology used in paper titles and abstracts.\nAvoid internal project names or marketing labels.\n\nStep 2 — Query construction:\nConstruct a keyword-based search query optimized for lexical search:\n- Use keyword phrases rather than full sentences\n- Combine terms using natural keyword adjacency (not prose)\n- Bias toward recall over precision\n\nStep 3 — Online retrieval:\nCall `online_search_papers` using the constructed query to find recent papers outside the internal database.",
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
