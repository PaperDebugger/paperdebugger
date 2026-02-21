import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DeleteConversationResponse,
  GetConversationResponse,
  ListConversationsResponse,
  ListSupportedModelsResponse,
  UpdateConversationResponse,
} from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { UseMutationOptionsOverride, UseQueryOptionsOverride } from "./types";
import {
  createPrompt,
  deleteConversation,
  deletePrompt,
  getConversation,
  getProject,
  listConversations,
  listPrompts,
  listSupportedModels,
  updateConversation,
  updatePrompt,
  getUserInstructions,
  upsertUserInstructions,
  getProjectInstructions,
  upsertProjectInstructions,
  getSessionUsage,
  getWeeklyUsage,
} from "./api";
import {
  CreatePromptResponse,
  DeletePromptResponse,
  ListPromptsResponse,
  UpdatePromptResponse,
  GetUserInstructionsResponse,
  UpsertUserInstructionsResponse,
} from "../pkg/gen/apiclient/user/v1/user_pb";
import { queryKeys } from "./keys";
import {
  GetProjectResponse,
  GetProjectInstructionsResponse,
  UpsertProjectInstructionsResponse,
} from "../pkg/gen/apiclient/project/v1/project_pb";
import {
  GetSessionUsageResponse,
  GetWeeklyUsageResponse,
} from "../pkg/gen/apiclient/usage/v1/usage_pb";
import { useAuthStore } from "../stores/auth-store";

export const useGetProjectQuery = (projectId: string, opts?: UseQueryOptionsOverride<GetProjectResponse>) => {
  return useQuery({
    queryKey: queryKeys.projects.getProject(projectId).queryKey,
    queryFn: () => getProject({ projectId }),
    ...opts,
  });
};

export const useListSupportedModelsQuery = (opts?: UseQueryOptionsOverride<ListSupportedModelsResponse>) => {
  return useQuery({
    queryKey: queryKeys.chats.listSupportedModels().queryKey,
    queryFn: () => listSupportedModels({}),
    ...opts,
  });
};

export const useListPromptsQuery = (opts?: UseQueryOptionsOverride<ListPromptsResponse>) => {
  return useQuery({
    queryKey: queryKeys.prompts.listPrompts().queryKey,
    queryFn: listPrompts,
    ...opts,
  });
};

export const useCreatePromptMutation = (opts?: UseMutationOptionsOverride<CreatePromptResponse>) => {
  return useMutation({
    mutationFn: createPrompt,
    ...opts,
  });
};

export const useUpdatePromptMutation = (opts?: UseMutationOptionsOverride<UpdatePromptResponse>) => {
  return useMutation({
    mutationFn: updatePrompt,
    ...opts,
  });
};

export const useDeletePromptMutation = (opts?: UseMutationOptionsOverride<DeletePromptResponse>) => {
  return useMutation({
    mutationFn: deletePrompt,
    ...opts,
  });
};

export const useListConversationsQuery = (
  projectId: string,
  opts?: UseQueryOptionsOverride<ListConversationsResponse>,
) => {
  // Only fetch if logged in
  const { user } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.conversations.listConversations(projectId).queryKey,
    queryFn: () => listConversations({ projectId }),
    enabled: !!user,
    ...opts,
  });
};

export const useDeleteConversationMutation = (opts?: UseMutationOptionsOverride<DeleteConversationResponse>) => {
  return useMutation({
    mutationFn: deleteConversation,
    ...opts,
  });
};

export const useGetConversationQuery = (
  conversationId: string,
  opts?: UseQueryOptionsOverride<GetConversationResponse>,
) => {
  return useQuery({
    queryKey: queryKeys.conversations.getConversation(conversationId).queryKey,
    queryFn: () => getConversation({ conversationId }),
    ...opts,
  });
};

// Removed: useCreateConversationMessageMutation - use streaming API instead

export const useUpdateConversationMutation = (opts?: UseMutationOptionsOverride<UpdateConversationResponse>) => {
  return useMutation({
    mutationFn: updateConversation,
    ...opts,
  });
};

// User Instructions
export const useGetUserInstructionsQuery = (opts?: UseQueryOptionsOverride<GetUserInstructionsResponse>) => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.users.getUserInstructions().queryKey,
    queryFn: () => getUserInstructions({}),
    enabled: !!user,
    ...opts,
  });
};

export const useUpsertUserInstructionsMutation = (
  opts?: UseMutationOptionsOverride<UpsertUserInstructionsResponse>,
) => {
  return useMutation({
    mutationFn: upsertUserInstructions,
    ...opts,
  });
};

// Project Instructions
export const useGetProjectInstructionsQuery = (
  projectId: string,
  opts?: UseQueryOptionsOverride<GetProjectInstructionsResponse>,
) => {
  return useQuery({
    queryKey: queryKeys.projects.getProjectInstructions(projectId).queryKey,
    queryFn: () => getProjectInstructions({ projectId }),
    enabled: !!projectId,
    ...opts,
  });
};

export const useUpsertProjectInstructionsMutation = (
  opts?: UseMutationOptionsOverride<UpsertProjectInstructionsResponse>,
) => {
  return useMutation({
    mutationFn: upsertProjectInstructions,
    ...opts,
  });
};

// Usage
export const useGetSessionUsageQuery = (opts?: UseQueryOptionsOverride<GetSessionUsageResponse>) => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.usage.getSessionUsage().queryKey,
    queryFn: () => getSessionUsage(),
    enabled: !!user,
    ...opts,
  });
};

export const useGetWeeklyUsageQuery = (opts?: UseQueryOptionsOverride<GetWeeklyUsageResponse>) => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.usage.getWeeklyUsage().queryKey,
    queryFn: () => getWeeklyUsage(),
    enabled: !!user,
    ...opts,
  });
};
