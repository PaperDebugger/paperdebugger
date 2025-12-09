import { StreamInitialization } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { useStreamingMessageStore } from "../../streaming-message-store";
import { MessageEntryStatus } from "../types";
import { logWarn } from "../../../libs/logger";
import { flushStreamingMessageToConversation } from "./converter";

export function handleStreamInitialization(streamInit: StreamInitialization, refetchConversationList: () => void) {
  useStreamingMessageStore.setState((prev) => ({
    ...prev,
    streamingMessage: {
      ...prev.streamingMessage,
      parts: prev.streamingMessage.parts.map((part) => {
        if (part.status === MessageEntryStatus.PREPARING && part.user) {
          return {
            ...part,
            status: MessageEntryStatus.FINALIZED,
          };
        }
        return part;
      }),
    },
  }));
  if (useStreamingMessageStore.getState().streamingMessage.parts.length !== 1) {
    logWarn("Streaming message parts length is not 1, this may indicate some stale messages in the store");
  }

  flushStreamingMessageToConversation(streamInit.conversationId, streamInit.languageModel);
  refetchConversationList(); // Here we refetch conversation list because user may send chat message and immediately open history to view.
}
