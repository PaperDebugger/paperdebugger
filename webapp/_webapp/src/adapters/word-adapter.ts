/**
 * WordAdapter
 *
 * Document adapter implementation for Microsoft Word Office Add-in.
 * Uses Office JavaScript API to interact with the document.
 *
 * Note: This adapter is designed to be used in the Web Component build
 * and injected by the Office Add-in host application.
 */

import type { DocumentAdapter, SelectionInfo } from "./types";

// Type declarations for Office JS (will be available at runtime)
declare const Word: {
  run: <T>(callback: (context: WordContext) => Promise<T>) => Promise<T>;
  InsertLocation: {
    start: string;
    end: string;
    before: string;
    after: string;
    replace: string;
  };
};

interface WordContext {
  document: {
    body: WordBody;
    getSelection(): WordRange;
  };
  sync(): Promise<void>;
}

interface WordBody {
  text: string;
  insertText(text: string, location: string): WordRange;
  load(properties: string): void;
}

interface WordRange {
  text: string;
  insertText(text: string, location: string): WordRange;
  load(properties: string): void;
}

export class WordAdapter implements DocumentAdapter {
  readonly platform = "word" as const;

  private _ready = false;

  constructor() {
    // Check if Office is available
    this._ready = typeof Word !== "undefined";
  }

  isReady(): boolean {
    return this._ready;
  }

  async getFullText(): Promise<string> {
    if (!this.isReady()) {
      throw new Error("Word API not available");
    }

    return Word.run(async (context) => {
      const body = context.document.body;
      body.load("text");
      await context.sync();
      return body.text;
    });
  }

  async getSelection(): Promise<SelectionInfo | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      return await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load("text");
        await context.sync();

        if (!selection.text || selection.text.trim() === "") {
          return null;
        }

        // Note: Word API doesn't provide easy access to surrounding context
        // We can potentially expand the range in future iterations
        return {
          text: selection.text,
          surroundingText: selection.text, // Simplified for now
          rangeId: undefined, // Word ranges are transient, can't easily serialize
        };
      });
    } catch (error) {
      console.error("Error getting Word selection:", error);
      return null;
    }
  }

  async insertText(text: string, location: "cursor" | "start" | "end" = "cursor"): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Word API not available");
    }

    await Word.run(async (context) => {
      if (location === "start") {
        context.document.body.insertText(text, Word.InsertLocation.start);
      } else if (location === "end") {
        context.document.body.insertText(text, Word.InsertLocation.end);
      } else {
        // Insert at cursor (current selection)
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.replace);
      }
      await context.sync();
    });
  }

  async replaceSelection(text: string, _rangeId?: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Word API not available");
    }

    // Note: rangeId is not used for Word as ranges are transient
    // We always operate on the current selection
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertText(text, Word.InsertLocation.replace);
      await context.sync();
    });
  }

  onSelectionChange(callback: (selection: SelectionInfo | null) => void): () => void {
    // Word doesn't have a built-in selection change event in the same way
    // We can use Office.context.document.addHandlerAsync for some events
    // For now, implement polling as a fallback
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastSelection: string | null = null;

    const checkSelection = async () => {
      try {
        const selection = await this.getSelection();
        const currentText = selection?.text ?? null;

        if (currentText !== lastSelection) {
          lastSelection = currentText;
          callback(selection);
        }
      } catch {
        // Ignore errors during polling
      }
    };

    // Poll every 500ms (not ideal but works for MVP)
    intervalId = setInterval(checkSelection, 500);
    // Initial check
    checkSelection();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }

  getDocumentId(): string {
    // Word documents don't have a simple project ID like Overleaf
    // Could potentially use Office.context.document.url or similar
    return "word-document";
  }
}

// Factory function to create WordAdapter
// This will be called by the Office Add-in host
export function createWordAdapter(): WordAdapter {
  return new WordAdapter();
}

