import { IncompleteIndicator } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { useStreamingMessageStore } from "../../streaming-message-store";

export function handleIncompleteIndicator(incompleteIndicator: IncompleteIndicator) {
  useStreamingMessageStore.getState().setIncompleteIndicator(incompleteIndicator);
}
