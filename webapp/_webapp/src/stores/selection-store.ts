import { create } from "zustand";
import { SetterStore } from "./types";
import { OverleafCodeMirror } from "../libs/inline-suggestion";
import { EditorView } from "@codemirror/view";

type CoreState = {
  selectedText: string | null;
  surroundingText: string | null;
  selectionRange: Range | null;
  lastSelectedText: string | null;
  lastSurroundingText: string | null;
  lastSelectionRange: Range | null;
  overleafCm: OverleafCodeMirror | null;
};

type SelectionStore = SetterStore<CoreState> & {
  clear: () => void;
  clearOverleafSelection: () => void;
  setLastSelection: (text: string | null, surrounding: string, range: Range | null) => void;
};

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedText: null,
  setSelectedText: (selectedText) => {
    set({ selectedText });
  },
  surroundingText: null,
  setSurroundingText: (surroundingText) => {
    set({ surroundingText });
  },
  lastSelectedText: null, // There's a case where user selects text, moves paperdebugger, then clicks Add to chat. In this case lastSelectedText is needed to restore the just-selected text.
  setLastSelectedText: (lastSelectedText) => {
    set({ lastSelectedText });
  },
  lastSurroundingText: null,
  setLastSurroundingText: (lastSurroundingText) => {
    set({ lastSurroundingText });
  },
  selectionRange: null,
  setSelectionRange: (selectionRange) => {
    set({ selectionRange });
  },
  lastSelectionRange: null,
  setLastSelectionRange: (lastSelectionRange) => {
    set({ lastSelectionRange });
  },
  setLastSelection: (lastSelectedText, lastSurroundingText, lastSelectionRange) => {
    set({ lastSelectedText, lastSurroundingText, lastSelectionRange });
  },
  clear: () => {
    set({ selectedText: null, surroundingText: null, selectionRange: null });
  },
  clearOverleafSelection: () => {
    const cmContentElement = document.querySelector(".cm-content");
    if (!cmContentElement) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorViewInstance = (cmContentElement as any).cmView.view as EditorView;
    if (!editorViewInstance) {
      return;
    }

    const endPos = editorViewInstance.state.selection.ranges[0].to;

    editorViewInstance.dispatch({
      selection: {
        anchor: endPos,
      },
    });
  },

  overleafCm: null,
  setOverleafCm: (overleafCm) => {
    set({ overleafCm });
  },
}));
