import apiclient, { RequestOptions } from "../libs/apiclient";
import {
  LoginByGoogleRequest,
  LoginByGoogleResponseSchema,
  LoginByOverleafRequest,
  LoginByOverleafResponseSchema,
  LogoutRequest,
  LogoutResponseSchema,
  RefreshTokenRequest,
  RefreshTokenResponseSchema,
} from "../pkg/gen/apiclient/auth/v1/auth_pb";
import {
  CreateConversationMessageRequest,
  CreateConversationMessageResponseSchema,
  CreateConversationMessageStreamResponse,
  CreateConversationMessageStreamResponseSchema,
  CreateConversationMessageStreamRequestSchema,
  DeleteConversationRequest,
  DeleteConversationResponseSchema,
  GetConversationRequest,
  GetConversationResponseSchema,
  ListConversationsRequest,
  ListConversationsResponseSchema,
  ListSupportedModelsRequest,
  ListSupportedModelsResponseSchema,
  UpdateConversationRequest,
  UpdateConversationResponseSchema,
} from "../pkg/gen/apiclient/chat/v1/chat_pb";
import {
  GetProjectRequest,
  GetProjectResponseSchema,
  RunProjectPaperScoreRequest,
  RunProjectPaperScoreResponseSchema,
  UpsertProjectRequest,
  UpsertProjectResponseSchema,
  GetProjectInstructionsRequest,
  GetProjectInstructionsResponseSchema,
  UpsertProjectInstructionsRequest,
  UpsertProjectInstructionsResponseSchema,
} from "../pkg/gen/apiclient/project/v1/project_pb";
import {
  GetSettingsResponseSchema,
  GetUserResponseSchema,
  ResetSettingsResponseSchema,
  UpdateSettingsRequest,
  UpdateSettingsResponseSchema,
  ListPromptsResponseSchema,
  CreatePromptRequest,
  CreatePromptResponseSchema,
  UpdatePromptRequest,
  UpdatePromptResponseSchema,
  DeletePromptRequest,
  DeletePromptResponseSchema,
  GetSettingsResponse,
  GetUserResponse,
  GetUserInstructionsResponseSchema,
  UpsertUserInstructionsRequest,
  UpsertUserInstructionsResponseSchema,
  GetUserInstructionsRequest,
} from "../pkg/gen/apiclient/user/v1/user_pb";
import { PlainMessage } from "./types";
import { create, toJson } from "@bufbuild/protobuf";
import { processStream, safeFromJson } from "./utils";
import { CommentsAcceptedRequest, CommentsAcceptedResponseSchema } from "../pkg/gen/apiclient/comment/v1/comment_pb";

export const loginByOverleaf = async (data: PlainMessage<LoginByOverleafRequest>) => {
  const response = await apiclient.post("/auth/login/overleaf", data);
  return safeFromJson(LoginByOverleafResponseSchema, response);
};

export const loginByGoogle = async (data: PlainMessage<LoginByGoogleRequest>) => {
  const response = await apiclient.post("/auth/login/google", data);
  return safeFromJson(LoginByGoogleResponseSchema, response);
};

export const refreshToken = async (data: PlainMessage<RefreshTokenRequest>) => {
  const response = await apiclient.post("/auth/refresh", data);
  return safeFromJson(RefreshTokenResponseSchema, response);
};

export const logout = async (data: PlainMessage<LogoutRequest>) => {
  const response = await apiclient.post("/auth/logout", data, {
    ignoreErrorToast: true,
  });
  return safeFromJson(LogoutResponseSchema, response);
};

export const getUser = async (): Promise<PlainMessage<GetUserResponse>> => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self", undefined, {
    ignoreErrorToast: true,
  });
  return safeFromJson(GetUserResponseSchema, response);
};

// New settings API endpoints
export const getSettings = async (): Promise<PlainMessage<GetSettingsResponse>> => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/settings", undefined, {
    ignoreErrorToast: true,
  });
  return safeFromJson(GetSettingsResponseSchema, response);
};

export const updateSettings = async (data: PlainMessage<UpdateSettingsRequest>) => {
  const response = await apiclient.put("/users/@self/settings", data);
  return safeFromJson(UpdateSettingsResponseSchema, response);
};

export const resetSettings = async () => {
  const response = await apiclient.post("/users/@self/settings/reset");
  return safeFromJson(ResetSettingsResponseSchema, response);
};

export const listConversations = async (data: PlainMessage<ListConversationsRequest>) => {
  const response = await apiclient.get("/chats/conversations", data);
  return safeFromJson(ListConversationsResponseSchema, response);
};

export const listSupportedModels = async (data: PlainMessage<ListSupportedModelsRequest>) => {
  const response = await apiclient.get("/chats/models", data);
  return safeFromJson(ListSupportedModelsResponseSchema, response);
};

export const getConversation = async (data: PlainMessage<GetConversationRequest>) => {
  const response = await apiclient.get(`/chats/conversations/${data.conversationId}`);
  return safeFromJson(GetConversationResponseSchema, response);
};

export const createConversationMessage = async (
  data: PlainMessage<CreateConversationMessageRequest>,
  options?: RequestOptions,
) => {
  const response = await apiclient.post(`/chats/conversations/messages`, data, options);
  return safeFromJson(CreateConversationMessageResponseSchema, response);
};

export const createConversationMessageStream = async (
  data: PlainMessage<CreateConversationMessageRequest>,
  onMessage: (chunk: CreateConversationMessageStreamResponse) => void,
) => {
  const stream = await apiclient.postStream(
    `/chats/conversations/messages/stream`,
    toJson(
      CreateConversationMessageStreamRequestSchema,
      create(CreateConversationMessageStreamRequestSchema, data),
    ),
  );
  await processStream(stream, CreateConversationMessageStreamResponseSchema, onMessage);
};

export const deleteConversation = async (data: PlainMessage<DeleteConversationRequest>) => {
  const response = await apiclient.delete(`/chats/conversations/${data.conversationId}`);
  return safeFromJson(DeleteConversationResponseSchema, response);
};

export const updateConversation = async (data: PlainMessage<UpdateConversationRequest>) => {
  const response = await apiclient.patch(`/chats/conversations/${data.conversationId}`, data);
  return safeFromJson(UpdateConversationResponseSchema, response);
};

export const getProject = async (data: PlainMessage<GetProjectRequest>) => {
  const response = await apiclient.get(`/projects/${data.projectId}`, data, {
    ignoreErrorToast: true,
  });
  return safeFromJson(GetProjectResponseSchema, response);
};

export const upsertProject = async (data: PlainMessage<UpsertProjectRequest>) => {
  const response = await apiclient.put(`/projects/${data.projectId}`, data);
  return safeFromJson(UpsertProjectResponseSchema, response);
};

export const listPrompts = async () => {
  if (!apiclient.hasToken()) {
    return safeFromJson(ListPromptsResponseSchema, { prompts: [] });
  }
  const response = await apiclient.get("/users/@self/prompts", undefined, {
    ignoreErrorToast: true,
  });
  return safeFromJson(ListPromptsResponseSchema, response);
};

export const createPrompt = async (data: PlainMessage<CreatePromptRequest>) => {
  const response = await apiclient.post("/users/@self/prompts", data);
  return safeFromJson(CreatePromptResponseSchema, response);
};

export const updatePrompt = async (data: PlainMessage<UpdatePromptRequest>) => {
  const response = await apiclient.put(`/users/@self/prompts/${data.promptId}`, data);
  return safeFromJson(UpdatePromptResponseSchema, response);
};

export const deletePrompt = async (data: PlainMessage<DeletePromptRequest>) => {
  const response = await apiclient.delete(`/users/@self/prompts/${data.promptId}`);
  return safeFromJson(DeletePromptResponseSchema, response);
};

export const getUserInstructions = async (data: PlainMessage<GetUserInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/instructions", data, {
    ignoreErrorToast: true,
  });
  return safeFromJson(GetUserInstructionsResponseSchema, response);
};

export const upsertUserInstructions = async (data: PlainMessage<UpsertUserInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.post("/users/@self/instructions", data);
  return safeFromJson(UpsertUserInstructionsResponseSchema, response);
};

// Deprecated, use function call in LLMs instead. We do not need to call this function anymore.
export const runProjectPaperScore = async (data: PlainMessage<RunProjectPaperScoreRequest>) => {
  const response = await apiclient.post(`/projects/${data.projectId}/paper-score`, data);
  return safeFromJson(RunProjectPaperScoreResponseSchema, response);
};

export const getProjectInstructions = async (data: PlainMessage<GetProjectInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get(`/projects/${data.projectId}/instructions`, undefined, {
    ignoreErrorToast: true,
  });
  return safeFromJson(GetProjectInstructionsResponseSchema, response);
};

export const upsertProjectInstructions = async (data: PlainMessage<UpsertProjectInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.post(`/projects/${data.projectId}/instructions`, data);
  return safeFromJson(UpsertProjectInstructionsResponseSchema, response);
};

export const acceptComments = async (data: PlainMessage<CommentsAcceptedRequest>) => {
  const response = await apiclient.post(`/comments/accepted`, data);
  return safeFromJson(CommentsAcceptedResponseSchema, response);
};
