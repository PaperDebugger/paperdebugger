import { fromJson } from "@bufbuild/protobuf";
import { Conversation, LanguageModel, Message, MessageSchema } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { MessageEntry, MessageEntryStatus } from "../types";
import { useStreamingMessageStore } from "../../streaming-message-store";
import { flushSync } from "react-dom";
import { useConversationStore } from "../conversation-store";

export const convertMessageEntryToMessage = (messageEntry: MessageEntry): Message | undefined => {
  if (messageEntry.assistant) {
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        assistant: {
          content: messageEntry.assistant.content,
        },
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

export const flushStreamingMessageToConversation = (conversationId?: string, languageModel?: LanguageModel) => {
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
      languageModel: languageModel ?? prev.languageModel,
      messages: [...prev.messages, ...flushMessages],
    }));
  });

  useStreamingMessageStore.getState().resetStreamingMessage();
  // Do not reset incomplete indicator here, it will be reset in useSendMessageStream
};
