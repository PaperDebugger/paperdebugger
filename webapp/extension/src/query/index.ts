import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CreateConversationMessageResponse,
  DeleteConversationResponse,
  GetConversationResponse,
  ListConversationsResponse,
  UpdateConversationResponse,
} from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { UseMutationOptionsOverride, UseQueryOptionsOverride } from "./types";
import {
  createConversationMessage,
  createPrompt,
  deleteConversation,
  deletePrompt,
  getConversation,
  getProject,
  listConversations,
  listPrompts,
  runProjectPaperScore,
  updateConversation,
  updatePrompt,
  getUserInstructions,
  upsertUserInstructions,
  getProjectInstructions,
  upsertProjectInstructions,
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
  RunProjectPaperScoreResponse,
  GetProjectInstructionsResponse,
  UpsertProjectInstructionsResponse,
} from "../pkg/gen/apiclient/project/v1/project_pb";
import { useAuthStore } from "../stores/auth-store";

// Deprecated
// export const useGetUserQuery = (
//   opts?: UseQueryOptionsOverride<GetUserResponse>,
// ) => {
//   return useQuery({
//     queryKey: queryKeys.users.getUser().queryKey,
//     queryFn: getUser,
//     ...opts,
//   });
// };

export const useGetProjectQuery = (projectId: string, opts?: UseQueryOptionsOverride<GetProjectResponse>) => {
  return useQuery({
    queryKey: queryKeys.projects.getProject(projectId).queryKey,
    queryFn: () => getProject({ projectId }),
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
  // 如果登录，才获取
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

export const useRunProjectPaperScoreMutation = (opts?: UseMutationOptionsOverride<RunProjectPaperScoreResponse>) => {
  return useMutation({
    mutationFn: runProjectPaperScore,
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

export const useCreateConversationMessageMutation = (
  opts?: UseMutationOptionsOverride<CreateConversationMessageResponse>,
) => {
  return useMutation({
    mutationFn: createConversationMessage,
    ...opts,
  });
};

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
    queryFn: getUserInstructions,
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
