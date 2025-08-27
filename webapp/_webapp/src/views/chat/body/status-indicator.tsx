import { LoadingIndicator } from "../../../components/loading-indicator";
import { UnknownEntryMessageContainer } from "../../../components/message-entry-container/unknown-entry";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { MessageEntryStatus } from "../../../stores/conversation/types";
import { useSocketStore } from "../../../stores/socket-store";
import { useStreamingMessageStore } from "../../../stores/streaming-message-store";

export const StatusIndicator = ({ conversation }: { conversation?: Conversation }) => {
  const { syncing, syncingProgress } = useSocketStore();
  const streamingMessage = useStreamingMessageStore((s) => s.streamingMessage);
  const incompleteIndicator = useStreamingMessageStore((s) => s.incompleteIndicator);

  const isWaitingForResponse =
    streamingMessage.parts.at(-1)?.user !== undefined ||
    (conversation?.messages.at(-1)?.payload?.messageType.case === "user" && streamingMessage.parts.length === 0);
  const hasStaleMessage = streamingMessage.parts.some((part) => part.status === MessageEntryStatus.STALE);
  const incompleteReason = incompleteIndicator?.reason;

  if (isWaitingForResponse) {
    if (syncing) {
      return (
        <div className="chat-message-entry">
          <LoadingIndicator text={`Reading your paper... ${syncingProgress}%`} />
        </div>
      );
    } else {
      return (
        <div className="chat-message-entry">
          <LoadingIndicator text={`Thinking...`} />
        </div>
      );
    }
  }

  if (hasStaleMessage) {
    return <UnknownEntryMessageContainer message={`Stream error *`} />;
  }

  if (incompleteReason) {
    return (
      <div className="chat-message-entry">
        <p className="indicator incomplete">
          {incompleteReason === "max_output_tokens"
            ? 'Max token reached. Say "continue" to continue.'
            : "The response is incomplete with the reason: " + incompleteReason}
        </p>
      </div>
    );
  }
};
