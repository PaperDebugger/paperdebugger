// Store "every streaming messages" occurred in the stream.

import { create } from "zustand";
import { MessageEntry } from "./conversation/types";
import { flushSync } from "react-dom";
import { IncompleteIndicator } from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { SetterResetterStore } from "./types";

export type StreamingMessage = {
  parts: MessageEntry[];
  sequence: number;
};

type CoreState = {
  streamingMessage: StreamingMessage;
  incompleteIndicator: IncompleteIndicator | null;
};

type StreamingMessageState = SetterResetterStore<CoreState>;

export const useStreamingMessageStore = create<StreamingMessageState>((set) => ({
  streamingMessage: { parts: [], sequence: 0 },
  setStreamingMessage: (message) => set({ streamingMessage: message }),
  resetStreamingMessage: () =>
    set({
      streamingMessage: { parts: [], sequence: 0 },
    }),
  updateStreamingMessage: (updater) => {
    // force React to synchronously flush any pending updates and
    // re-render the component immediately after each store update, rather than batching them together.
    flushSync(() => {
      set((state) => {
        const newState = updater(state.streamingMessage);
        return { streamingMessage: newState };
      });
    });
  },

  incompleteIndicator: null,
  setIncompleteIndicator: (incompleteIndicator) => {
    set({ incompleteIndicator });
  },
  resetIncompleteIndicator: () => set({ incompleteIndicator: null }),
  updateIncompleteIndicator: (updater) => {
    set((state) => {
      const newState = updater(state.incompleteIndicator);
      return { incompleteIndicator: newState };
    });
  },
}));
