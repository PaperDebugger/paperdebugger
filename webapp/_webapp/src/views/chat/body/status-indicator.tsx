import { LoadingIndicator } from "../../../components/loading-indicator";
import { UnknownEntryMessageContainer } from "../../../components/message-entry-container/unknown-entry";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import { useSocketStore } from "../../../stores/socket-store";
import { useStreamingStateMachine } from "../../../stores/streaming";

export const StatusIndicator = ({ conversation }: { conversation?: Conversation }) => {
  const { syncing, syncingProgress } = useSocketStore();
  const streamingMessage = useStreamingStateMachine((s) => s.streamingMessage);
  const incompleteIndicator = useStreamingStateMachine((s) => s.incompleteIndicator);

  const isWaitingForResponse =
    streamingMessage.parts.at(-1)?.role === "user" ||
    (conversation?.messages.at(-1)?.payload?.messageType.case === "user" && streamingMessage.parts.length === 0);
  const hasStaleMessage = streamingMessage.parts.some((part) => part.status === "stale");
  const incompleteReason = incompleteIndicator?.reason;

  // Check if AI is thinking (has assistant message part but no content/reasoning yet)
  const lastStreamingPart = streamingMessage.parts.at(-1);
  const isThinking =
    lastStreamingPart?.role === "assistant" &&
    lastStreamingPart.status === "streaming" &&
    (!lastStreamingPart.data.content || lastStreamingPart.data.content.length === 0) &&
    (!lastStreamingPart.data.reasoning || lastStreamingPart.data.reasoning.length === 0);

  // Show loading/thinking indicator when waiting for response or AI is thinking
  if (isWaitingForResponse || isThinking) {
    if (syncing) {
      return (
        <div className="chat-message-entry">
          <LoadingIndicator text={`Reading your paper... ${syncingProgress}%`} />
        </div>
      );
    }
    return (
      <div className="chat-message-entry">
        <LoadingIndicator text={`Thinking...`} />
      </div>
    );
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
