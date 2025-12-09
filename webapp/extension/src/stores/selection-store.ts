import { create } from "zustand";
import { SetterStore } from "./types";
import { OverleafCodeMirror } from "../libs/inline-suggestion";
import { EditorView } from "@codemirror/view";

type CoreState = {
  selectedText: string | null;
  selectionRange: Range | null;
  lastSelectedText: string | null;
  lastSelectionRange: Range | null;
  overleafCm: OverleafCodeMirror | null;
};

type SelectionStore = SetterStore<CoreState> & {
  clear: () => void;
  clearOverleafSelection: () => void;
};

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedText: null,
  setSelectedText: (selectedText) => {
    set({ selectedText });
  },
  lastSelectedText: null, // 有一种情况：用户选择了文本，移动了一下 paperdebugger，然后点击 Add to chat。这个时候需要 lastSelectedText 来恢复刚刚选中的文本。
  setLastSelectedText: (lastSelectedText) => {
    set({ lastSelectedText });
  },
  selectionRange: null,
  setSelectionRange: (selectionRange) => {
    set({ selectionRange });
  },
  lastSelectionRange: null,
  setLastSelectionRange: (lastSelectionRange) => {
    set({ lastSelectionRange });
  },
  clear: () => {
    set({ selectedText: null, selectionRange: null });
  },
  clearOverleafSelection: () => {
    let cmContentElement = document.querySelector(".cm-content");
    if (!cmContentElement) {
      return;
    }

    let editorViewInstance = (cmContentElement as any).cmView.view as EditorView;
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
