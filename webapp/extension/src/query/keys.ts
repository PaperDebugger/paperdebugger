import { createQueryKeyStore } from "@lukemorales/query-key-factory";

export const queryKeys = createQueryKeyStore({
  users: {
    getUser: () => ["users", "@self"],
    getUserInstructions: () => ["users", "@self", "instructions"],
  },
  prompts: {
    listPrompts: () => ["users", "@self", "prompts"],
  },
  conversations: {
    listConversations: (projectId: string) => ["conversations", projectId],
    getConversation: (conversationId: string) => ["conversations", conversationId],
  },
  projects: {
    getProject: (projectId: string) => ["projects", projectId],
    runProjectPaperScore: (projectId: string, conversationId: string) => [
      "projects",
      "paper-score",
      projectId,
      conversationId,
    ],
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
