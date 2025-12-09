import { StreamFinalization } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { flushStreamingMessageToConversation } from "./converter";

export function handleStreamFinalization(_finalization: StreamFinalization) {
  flushStreamingMessageToConversation(_finalization.conversationId);
}
