import apiclient, { apiclientV2 } from "../libs/apiclient";
import {
  LoginByGoogleRequest,
  LoginByGoogleResponseSchema,
  LoginByOverleafRequest,
  LoginByOverleafResponseSchema,
  LogoutRequest,
  LogoutResponseSchema,
} from "../pkg/gen/apiclient/auth/v1/auth_pb";
import {
  CreateConversationMessageStreamRequest,
  CreateConversationMessageStreamResponse,
  CreateConversationMessageStreamResponseSchema,
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
  GetCitationKeysRequest,
  GetCitationKeysResponseSchema,
} from "../pkg/gen/apiclient/chat/v2/chat_pb";
import {
  GetProjectRequest,
  GetProjectResponseSchema,
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
import { fromJson } from "../libs/protobuf-utils";
import { processStream } from "./utils";
import { CommentsAcceptedRequest, CommentsAcceptedResponseSchema } from "../pkg/gen/apiclient/comment/v1/comment_pb";

export const loginByOverleaf = async (data: PlainMessage<LoginByOverleafRequest>) => {
  const response = await apiclient.post("/auth/login/overleaf", data);
  return fromJson(LoginByOverleafResponseSchema, response);
};

export const loginByGoogle = async (data: PlainMessage<LoginByGoogleRequest>) => {
  const response = await apiclient.post("/auth/login/google", data);
  return fromJson(LoginByGoogleResponseSchema, response);
};

export const logout = async (data: PlainMessage<LogoutRequest>) => {
  const response = await apiclient.post("/auth/logout", data, {
    ignoreErrorToast: true,
  });
  return fromJson(LogoutResponseSchema, response);
};

export const getUser = async (): Promise<PlainMessage<GetUserResponse>> => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self", undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(GetUserResponseSchema, response);
};

// New settings API endpoints
export const getSettings = async (): Promise<PlainMessage<GetSettingsResponse>> => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/settings", undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(GetSettingsResponseSchema, response);
};

export const updateSettings = async (data: PlainMessage<UpdateSettingsRequest>) => {
  const response = await apiclient.put("/users/@self/settings", data);
  return fromJson(UpdateSettingsResponseSchema, response);
};

export const resetSettings = async () => {
  const response = await apiclient.post("/users/@self/settings/reset");
  return fromJson(ResetSettingsResponseSchema, response);
};

export const listConversations = async (data: PlainMessage<ListConversationsRequest>) => {
  const response = await apiclientV2.get("/chats/conversations", data);
  return fromJson(ListConversationsResponseSchema, response);
};

export const listSupportedModels = async (data: PlainMessage<ListSupportedModelsRequest>) => {
  const response = await apiclientV2.get("/chats/models", data);
  return fromJson(ListSupportedModelsResponseSchema, response);
};

export const getConversation = async (data: PlainMessage<GetConversationRequest>) => {
  const response = await apiclientV2.get(`/chats/conversations/${data.conversationId}`);
  return fromJson(GetConversationResponseSchema, response);
};

export const createConversationMessageStream = async (
  data: PlainMessage<CreateConversationMessageStreamRequest>,
  onMessage: (chunk: CreateConversationMessageStreamResponse) => void,
) => {
  const stream = await apiclientV2.postStream(`/chats/conversations/messages/stream`, data);
  await processStream(stream, CreateConversationMessageStreamResponseSchema, onMessage);
};

export const deleteConversation = async (data: PlainMessage<DeleteConversationRequest>) => {
  const response = await apiclientV2.delete(`/chats/conversations/${data.conversationId}`);
  return fromJson(DeleteConversationResponseSchema, response);
};

export const updateConversation = async (data: PlainMessage<UpdateConversationRequest>) => {
  const response = await apiclientV2.patch(`/chats/conversations/${data.conversationId}`, data);
  return fromJson(UpdateConversationResponseSchema, response);
};

export const getProject = async (data: PlainMessage<GetProjectRequest>) => {
  const response = await apiclient.get(`/projects/${data.projectId}`, data, {
    ignoreErrorToast: true,
  });
  return fromJson(GetProjectResponseSchema, response);
};

export const getCitationKeys = async (data: PlainMessage<GetCitationKeysRequest>) => {
  const response = await apiclientV2.get(`/chats/citation-keys`, data, {
    ignoreErrorToast: true,
  });
  return fromJson(GetCitationKeysResponseSchema, response);
};

export const upsertProject = async (data: PlainMessage<UpsertProjectRequest>) => {
  const response = await apiclient.put(`/projects/${data.projectId}`, data);
  return fromJson(UpsertProjectResponseSchema, response);
};

export const listPrompts = async () => {
  if (!apiclient.hasToken()) {
    return fromJson(ListPromptsResponseSchema, { prompts: [] });
  }
  const response = await apiclient.get("/users/@self/prompts", undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(ListPromptsResponseSchema, response);
};

export const createPrompt = async (data: PlainMessage<CreatePromptRequest>) => {
  const response = await apiclient.post("/users/@self/prompts", data);
  return fromJson(CreatePromptResponseSchema, response);
};

export const updatePrompt = async (data: PlainMessage<UpdatePromptRequest>) => {
  const response = await apiclient.put(`/users/@self/prompts/${data.promptId}`, data);
  return fromJson(UpdatePromptResponseSchema, response);
};

export const deletePrompt = async (data: PlainMessage<DeletePromptRequest>) => {
  const response = await apiclient.delete(`/users/@self/prompts/${data.promptId}`);
  return fromJson(DeletePromptResponseSchema, response);
};

export const getUserInstructions = async (data: PlainMessage<GetUserInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/instructions", data, {
    ignoreErrorToast: true,
  });
  return fromJson(GetUserInstructionsResponseSchema, response);
};

export const upsertUserInstructions = async (data: PlainMessage<UpsertUserInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.post("/users/@self/instructions", data);
  return fromJson(UpsertUserInstructionsResponseSchema, response);
};

export const getProjectInstructions = async (data: PlainMessage<GetProjectInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get(`/projects/${data.projectId}/instructions`, undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(GetProjectInstructionsResponseSchema, response);
};

export const upsertProjectInstructions = async (data: PlainMessage<UpsertProjectInstructionsRequest>) => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.post(`/projects/${data.projectId}/instructions`, data);
  return fromJson(UpsertProjectInstructionsResponseSchema, response);
};

export const acceptComments = async (data: PlainMessage<CommentsAcceptedRequest>) => {
  const response = await apiclient.post(`/comments/accepted`, data);
  return fromJson(CommentsAcceptedResponseSchema, response);
};

// Usage
import {
  GetSessionUsageResponseSchema,
  GetWeeklyUsageResponseSchema,
} from "../pkg/gen/apiclient/usage/v1/usage_pb";

export const getSessionUsage = async () => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/usage/session", undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(GetSessionUsageResponseSchema, response);
};

export const getWeeklyUsage = async () => {
  if (!apiclient.hasToken()) {
    throw new Error("No token");
  }
  const response = await apiclient.get("/users/@self/usage/weekly", undefined, {
    ignoreErrorToast: true,
  });
  return fromJson(GetWeeklyUsageResponseSchema, response);
};
