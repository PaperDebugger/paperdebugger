import { createQueryKeyStore } from "@lukemorales/query-key-factory";

export const queryKeys = createQueryKeyStore({
  users: {
    getUser: () => ["users", "@self"],
    getUserInstructions: () => ["users", "@self", "instructions"],
  },
  usage: {
    getSessionUsage: () => ["users", "@self", "usage", "session"],
    getWeeklyUsage: () => ["users", "@self", "usage", "weekly"],
  },
  prompts: {
    listPrompts: () => ["users", "@self", "prompts"],
  },
  chats: {
    listSupportedModels: () => ["chats", "models"],
  },
  conversations: {
    listConversations: (projectId: string) => ["conversations", projectId],
    getConversation: (conversationId: string) => ["conversations", conversationId],
  },
  projects: {
    getProject: (projectId: string) => ["projects", projectId],
    getProjectInstructions: (projectId: string) => ["projects", projectId, "instructions"],
  },
  comments: {
    accepted: (projectId: string, conversationId: string, commentIds: string[]) => [
      "comments",
      "accepted",
      projectId,
      conversationId,
      ...commentIds,
    ],
  },
});
