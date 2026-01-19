import { fromJson } from "../../../libs/protobuf-utils";
import { Conversation, Message, MessageSchema } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import { MessageEntry, MessageEntryStatus } from "../types";
import { useStreamingMessageStore } from "../../streaming-message-store";
import { flushSync } from "react-dom";
import { useConversationStore } from "../conversation-store";
import { getConversation } from "../../../query/api";

export const convertMessageEntryToMessage = (messageEntry: MessageEntry): Message | undefined => {
  if (messageEntry.assistant) {
    const assistantPayload: { content: string; reasoning?: string } = {
      content: messageEntry.assistant.content,
    };
    if (messageEntry.assistant.reasoning) {
      assistantPayload.reasoning = messageEntry.assistant.reasoning;
    }
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        assistant: assistantPayload,
      },
    });
  } else if (messageEntry.toolCall) {
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        toolCall: {
          name: messageEntry.toolCall.name,
          args: messageEntry.toolCall.args,
          result: messageEntry.toolCall.result,
          error: messageEntry.toolCall.error,
        },
      },
    });
  } else if (messageEntry.user) {
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        user: {
          content: messageEntry.user.content,
          selectedText: messageEntry.user.selectedText ?? "",
        },
      },
    });
  }
  return undefined;
};

export const flushStreamingMessageToConversation = (conversationId?: string, modelSlug?: string) => {
  const flushMessages = useStreamingMessageStore
    .getState()
    .streamingMessage.parts.map((part) => {
      if (part.status === MessageEntryStatus.FINALIZED) {
        return convertMessageEntryToMessage(part);
      } else {
        return null;
      }
    })
    .filter((part) => {
      return part !== null && part !== undefined;
    }) as Message[];

  flushSync(() => {
    useConversationStore.getState().updateCurrentConversation((prev: Conversation) => ({
      ...prev,
      id: conversationId ?? prev.id,
      modelSlug: modelSlug ?? prev.modelSlug,
      messages: [...prev.messages, ...flushMessages],
    }));
  });

  useStreamingMessageStore.getState().resetStreamingMessage();
  // Do not reset incomplete indicator here, it will be reset in useSendMessageStream

  // Async update branch info (doesn't block, doesn't overwrite messages)
  if (conversationId) {
    updateBranchInfoAsync(conversationId);
  }
};

// Fetch branch info from server and update only branch-related fields
// This preserves the messages (including reasoning) while updating branch info
const updateBranchInfoAsync = async (conversationId: string) => {
  try {
    const response = await getConversation({ conversationId });
    if (response.conversation) {
      const branchInfo = response.conversation;
      useConversationStore.getState().updateCurrentConversation((prev: Conversation) => ({
        ...prev,
        // Only update branch-related fields, keep messages intact
        currentBranchId: branchInfo.currentBranchId,
        branches: branchInfo.branches,
        currentBranchIndex: branchInfo.currentBranchIndex,
        totalBranches: branchInfo.totalBranches,
      }));
    }
  } catch (error) {
    console.error("Failed to update branch info:", error);
    // Non-critical error, branch switcher just won't show
  }
};
