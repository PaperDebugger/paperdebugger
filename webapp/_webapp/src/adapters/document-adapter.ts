/**
 * OverleafAdapter
 *
 * Document adapter implementation for Overleaf/browser environment.
 * Uses CodeMirror editor APIs to interact with the document.
 */

import { EditorView } from "@codemirror/view";
import type { DocumentAdapter, SelectionInfo } from "./types";
import { getCodeMirrorView, getProjectId } from "../libs/helpers";

export class OverleafAdapter implements DocumentAdapter {
  readonly platform = "overleaf" as const;

  private getEditorView(): EditorView | null {
    return getCodeMirrorView();
  }

  isReady(): boolean {
    return this.getEditorView() !== null;
  }

  async getFullText(): Promise<string> {
    const view = this.getEditorView();
    if (!view) {
      return "";
    }
    return view.state.doc.toString();
  }

  async getSelection(): Promise<SelectionInfo | null> {
    const view = this.getEditorView();
    if (!view) {
      return null;
    }

    const selection = view.state.selection.main;
    if (selection.empty) {
      return null;
    }

    const text = view.state.sliceDoc(selection.from, selection.to);
    const doc = view.state.doc;

    // Get surrounding context
    const contextBefore = doc.sliceString(Math.max(0, selection.from - 100), selection.from);
    const contextAfter = doc.sliceString(selection.to, Math.min(doc.length, selection.to + 100));
    const surroundingText = `${contextBefore}[SELECTED_TEXT_START]${text}[SELECTED_TEXT_END]${contextAfter}`;

    // Create a range identifier that can be used later
    const rangeId = JSON.stringify({ from: selection.from, to: selection.to });

    return {
      text,
      surroundingText,
      rangeId,
    };
  }

  async insertText(text: string, location: "cursor" | "start" | "end" = "cursor"): Promise<void> {
    const view = this.getEditorView();
    if (!view) {
      throw new Error("Editor not available");
    }

    let pos: number;
    switch (location) {
      case "start":
        pos = 0;
        break;
      case "end":
        pos = view.state.doc.length;
        break;
      case "cursor":
      default:
        pos = view.state.selection.main.head;
        break;
    }

    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
  }

  async replaceSelection(text: string, rangeId?: string): Promise<void> {
    const view = this.getEditorView();
    if (!view) {
      throw new Error("Editor not available");
    }

    let from: number;
    let to: number;

    if (rangeId) {
      try {
        const range = JSON.parse(rangeId);
        from = range.from;
        to = range.to;
      } catch {
        // If rangeId is invalid, use current selection
        from = view.state.selection.main.from;
        to = view.state.selection.main.to;
      }
    } else {
      from = view.state.selection.main.from;
      to = view.state.selection.main.to;
    }

    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
  }

  onSelectionChange(callback: (selection: SelectionInfo | null) => void): () => void {
    const handler = () => {
      this.getSelection().then(callback);
    };

    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
    };
  }

  getDocumentId(): string {
    return getProjectId();
  }
}

// Singleton instance for browser environment
let overleafAdapterInstance: OverleafAdapter | null = null;

export function getOverleafAdapter(): OverleafAdapter {
  if (!overleafAdapterInstance) {
    overleafAdapterInstance = new OverleafAdapter();
  }
  return overleafAdapterInstance;
}

