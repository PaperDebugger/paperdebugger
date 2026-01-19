/**
 * Streaming Message Store (Backward Compatibility Layer)
 *
 * This file now serves as a backward compatibility layer that re-exports
 * functionality from the new StreamingStateMachine.
 *
 * For new code, prefer importing directly from '../stores/streaming'.
 *
 * @deprecated Use useStreamingStateMachine from '../stores/streaming' instead
 */

import { flushSync } from "react-dom";
import { IncompleteIndicator } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import {
  useStreamingStateMachine,
  StreamingMessage,
} from "./streaming";

// Re-export types for backward compatibility
export type { StreamingMessage } from "./streaming";

/**
 * Backward-compatible streaming message store.
 *
 * This creates a compatible interface by delegating to the new state machine.
 * The store interface is maintained for existing consumers.
 */
export const useStreamingMessageStore = Object.assign(
  // Main selector function - allows use like useStreamingMessageStore((s) => s.streamingMessage)
  function <T>(selector: (state: {
    streamingMessage: StreamingMessage;
    incompleteIndicator: IncompleteIndicator | null;
  }) => T): T {
    return useStreamingStateMachine((state) =>
      selector({
        streamingMessage: state.streamingMessage,
        incompleteIndicator: state.incompleteIndicator,
      })
    );
  },
  // Static methods for direct store access
  {
    getState: () => ({
      streamingMessage: useStreamingStateMachine.getState().streamingMessage,
      incompleteIndicator: useStreamingStateMachine.getState().incompleteIndicator,
      setStreamingMessage: (message: StreamingMessage) => {
        useStreamingStateMachine.setState({ streamingMessage: message });
      },
      resetStreamingMessage: () => {
        useStreamingStateMachine.setState({
          streamingMessage: { parts: [], sequence: 0 },
        });
      },
      updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => {
        flushSync(() => {
          useStreamingStateMachine.setState((state) => ({
            streamingMessage: updater(state.streamingMessage),
          }));
        });
      },
      setIncompleteIndicator: (indicator: IncompleteIndicator | null) => {
        useStreamingStateMachine.setState({ incompleteIndicator: indicator });
      },
      resetIncompleteIndicator: () => {
        useStreamingStateMachine.setState({ incompleteIndicator: null });
      },
      updateIncompleteIndicator: (
        updater: (prev: IncompleteIndicator | null) => IncompleteIndicator | null
      ) => {
        useStreamingStateMachine.setState((state) => ({
          incompleteIndicator: updater(state.incompleteIndicator),
        }));
      },
    }),
    setState: (
      partial:
        | Partial<{ streamingMessage: StreamingMessage; incompleteIndicator: IncompleteIndicator | null }>
        | ((state: { streamingMessage: StreamingMessage; incompleteIndicator: IncompleteIndicator | null }) => Partial<{ streamingMessage: StreamingMessage; incompleteIndicator: IncompleteIndicator | null }>)
    ) => {
      if (typeof partial === "function") {
        const currentState = {
          streamingMessage: useStreamingStateMachine.getState().streamingMessage,
          incompleteIndicator: useStreamingStateMachine.getState().incompleteIndicator,
        };
        const newPartial = partial(currentState);
        useStreamingStateMachine.setState(newPartial);
      } else {
        useStreamingStateMachine.setState(partial);
      }
    },
  }
);
