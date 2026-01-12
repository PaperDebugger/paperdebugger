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

declare const Office: {
  context: {
    document: {
      url?: string;
      settings: {
        get(name: string): unknown;
        set(name: string, value: unknown): void;
        saveAsync(callback?: (result: { status: string; error?: Error }) => void): void;
      };
    };
  };
  AsyncResultStatus: {
    Succeeded: string;
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

const DOCUMENT_ID_SETTINGS_KEY = "pd.documentId";

export class WordAdapter implements DocumentAdapter {
  readonly platform = "word" as const;

  private _ready = false;
  private _documentId: string | null = null;

  constructor() {
    // Check if Office is available
    this._ready = typeof Word !== "undefined";
    // Initialize document ID from settings
    this._initDocumentId();
  }

  /**
   * Initialize document ID from Office settings or generate a new one.
   * Uses Office.context.document.settings to persist the ID with the document.
   */
  private _initDocumentId(): void {
    if (!this._ready || typeof Office === "undefined") {
      this._documentId = this._generateUUID();
      return;
    }

    try {
      const settings = Office.context.document.settings;

      // Try to get existing document ID from settings
      const existingId = settings.get(DOCUMENT_ID_SETTINGS_KEY) as string | null;
      if (existingId) {
        this._documentId = existingId;
        return;
      }

      // Try to use document URL for OneDrive/SharePoint documents
      let newId: string;
      if (Office.context?.document?.url) {
        // Use URL hash for cloud documents - more stable than raw URL
        newId = "word-" + this._hashString(Office.context.document.url);
      } else {
        // Generate new UUID for local documents
        newId = "word-" + this._generateUUID();
      }

      // Save to settings and persist
      settings.set(DOCUMENT_ID_SETTINGS_KEY, newId);
      settings.saveAsync((result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          console.warn("Failed to save document ID to settings:", result.error);
        }
      });

      this._documentId = newId;
    } catch (error) {
      console.warn("Error initializing document ID:", error);
      this._documentId = "word-" + this._generateUUID();
    }
  }

  /**
   * Generate a UUID v4 string
   */
  private _generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a hash string from input (for stable IDs from URLs)
   */
  private _hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
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

  /**
   * Get unique document identifier.
   * Returns a persistent ID stored in document settings.
   * The ID is generated once and saved with the document.
   */
  getDocumentId(): string {
    // Return cached ID (initialized in constructor)
    return this._documentId ?? "word-document";
  }
}

// Factory function to create WordAdapter
// This will be called by the Office Add-in host
export function createWordAdapter(): WordAdapter {
  return new WordAdapter();
}

