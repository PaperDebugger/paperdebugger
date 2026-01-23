/**
 * WordAdapter for Office Add-in
 *
 * This is the host-side implementation of the DocumentAdapter interface.
 * It uses the Office JavaScript API to interact with Word documents.
 */

/* global Word, Office */

import type { DocumentAdapter, SelectionInfo } from "./types";

const DOCUMENT_ID_SETTINGS_KEY = "pd.documentId";

export class WordAdapter implements DocumentAdapter {
  readonly platform = "word" as const;
  private _ready = false;
  private _documentId: string | null = null;
  private _lastDocumentUrl: string | null = null;

  constructor() {
    // Check if Office and Word are available
    this._ready = typeof Office !== "undefined" && typeof Word !== "undefined";
    // Initialize document ID from settings
    this._initDocumentId();
  }

  /**
   * Initialize document ID from Office settings or generate a new one.
   * Uses Office.context.document.settings to persist the ID with the document.
   */
  private _initDocumentId(): void {
    if (!this._ready) {
      this._documentId = this._generateUUID();
      return;
    }

    try {
      // Track current document URL to detect document changes
      const currentUrl = Office.context?.document?.url ?? null;
      this._lastDocumentUrl = currentUrl;

      const settings = Office.context.document.settings;

      // Try to get existing document ID from settings
      const existingId = settings.get(DOCUMENT_ID_SETTINGS_KEY) as string | null;
      if (existingId) {
        this._documentId = existingId;
        return;
      }

      // Try to use document URL for OneDrive/SharePoint documents
      let newId: string;
      if (currentUrl) {
        // Use URL hash for cloud documents - more stable than raw URL
        newId = "word-url-" + this._hashString(currentUrl);
      } else {
        // Generate new UUID for local documents
        newId = "word-uuid-" + this._generateUUID();
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
      this._documentId = "word-uuid-" + this._generateUUID();
    }
  }

  /**
   * Check if the current document has changed since last check.
   * If so, reinitialize the document ID.
   */
  private _checkDocumentChanged(): void {
    if (!this._ready) return;

    try {
      const currentUrl = Office.context?.document?.url ?? null;

      // If URL changed (including from null to something or vice versa), reinitialize
      if (currentUrl !== this._lastDocumentUrl) {
        console.log("[WordAdapter] Document changed, reinitializing document ID");
        this._initDocumentId();
      }
    } catch (error) {
      console.warn("[WordAdapter] Error checking document change:", error);
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

        // Try to get surrounding context
        const body = context.document.body;
        body.load("text");

        await context.sync();

        if (!selection.text || selection.text.trim() === "") {
          return null;
        }

        // Create surrounding text context
        const fullText = body.text;
        const selectedText = selection.text;
        const selectionIndex = fullText.indexOf(selectedText);

        let surroundingText = selectedText;
        if (selectionIndex !== -1) {
          const beforeStart = Math.max(0, selectionIndex - 100);
          const afterEnd = Math.min(fullText.length, selectionIndex + selectedText.length + 100);
          const before = fullText.substring(beforeStart, selectionIndex);
          const after = fullText.substring(selectionIndex + selectedText.length, afterEnd);
          surroundingText = `${before}[SELECTED_TEXT_START]${selectedText}[SELECTED_TEXT_END]${after}`;
        }

        return {
          text: selection.text,
          surroundingText,
          rangeId: undefined,
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

    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertText(text, Word.InsertLocation.replace);
      await context.sync();
    });
  }

  onSelectionChange(callback: (selection: SelectionInfo | null) => void): () => void {
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

    intervalId = setInterval(checkSelection, 1000);
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
   * Also checks if the document has changed since last call.
   */
  getDocumentId(): string {
    // Check if document has changed (e.g., user opened a different file)
    this._checkDocumentChanged();

    // Return cached ID (initialized in constructor or after document change)
    return this._documentId ?? "word-uuid-stale-" + this._generateUUID();
  }
}

/**
 * Create and register the adapter with the PaperDebugger Web Component
 */
export function createAndRegisterWordAdapter(): WordAdapter {
  const adapter = new WordAdapter();

  // Register with the global registry from paperdebugger webapp
  const win = window as unknown as {
    __pdRegisterAdapter?: (id: string, adapter: DocumentAdapter) => void;
  };

  if (win.__pdRegisterAdapter) {
    win.__pdRegisterAdapter("word-default", adapter);
  }

  return adapter;
}

/**
 * WordAdapter for Office Add-in
 *
 * This is the host-side implementation of the DocumentAdapter interface.
 * It uses the Office JavaScript API to interact with Word documents.
 */

/* global Word, Office */

import type { DocumentAdapter, SelectionInfo } from "./types";

const DOCUMENT_ID_SETTINGS_KEY = "pd.documentId";

export class WordAdapter implements DocumentAdapter {
  readonly platform = "word" as const;
  private _ready = false;
  private _documentId: string | null = null;
  private _lastDocumentUrl: string | null = null;

  constructor() {
    // Check if Office and Word are available
    this._ready = typeof Office !== "undefined" && typeof Word !== "undefined";
    // Initialize document ID from settings
    this._initDocumentId();
  }

  /**
   * Initialize document ID from Office settings or generate a new one.
   * Uses Office.context.document.settings to persist the ID with the document.
   */
  private _initDocumentId(): void {
    if (!this._ready) {
      this._documentId = this._generateUUID();
      return;
    }

    try {
      // Track current document URL to detect document changes
      const currentUrl = Office.context?.document?.url ?? null;
      this._lastDocumentUrl = currentUrl;

      const settings = Office.context.document.settings;

      // Try to get existing document ID from settings
      const existingId = settings.get(DOCUMENT_ID_SETTINGS_KEY) as string | null;
      if (existingId) {
        this._documentId = existingId;
        return;
      }

      // Try to use document URL for OneDrive/SharePoint documents
      let newId: string;
      if (currentUrl) {
        // Use URL hash for cloud documents - more stable than raw URL
        newId = "word-url-" + this._hashString(currentUrl);
      } else {
        // Generate new UUID for local documents
        newId = "word-uuid-" + this._generateUUID();
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
      this._documentId = "word-uuid-" + this._generateUUID();
    }
  }

  /**
   * Check if the current document has changed since last check.
   * If so, reinitialize the document ID.
   */
  private _checkDocumentChanged(): void {
    if (!this._ready) return;

    try {
      const currentUrl = Office.context?.document?.url ?? null;

      // If URL changed (including from null to something or vice versa), reinitialize
      if (currentUrl !== this._lastDocumentUrl) {
        console.log("[WordAdapter] Document changed, reinitializing document ID");
        this._initDocumentId();
      }
    } catch (error) {
      console.warn("[WordAdapter] Error checking document change:", error);
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

        // Try to get surrounding context
        const body = context.document.body;
        body.load("text");

        await context.sync();

        if (!selection.text || selection.text.trim() === "") {
          return null;
        }

        // Create surrounding text context
        const fullText = body.text;
        const selectedText = selection.text;
        const selectionIndex = fullText.indexOf(selectedText);

        let surroundingText = selectedText;
        if (selectionIndex !== -1) {
          const beforeStart = Math.max(0, selectionIndex - 100);
          const afterEnd = Math.min(fullText.length, selectionIndex + selectedText.length + 100);
          const before = fullText.substring(beforeStart, selectionIndex);
          const after = fullText.substring(selectionIndex + selectedText.length, afterEnd);
          surroundingText = `${before}[SELECTED_TEXT_START]${selectedText}[SELECTED_TEXT_END]${after}`;
        }

        return {
          text: selection.text,
          surroundingText,
          rangeId: undefined,
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

    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.insertText(text, Word.InsertLocation.replace);
      await context.sync();
    });
  }

  onSelectionChange(callback: (selection: SelectionInfo | null) => void): () => void {
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

    intervalId = setInterval(checkSelection, 500);
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
   * Also checks if the document has changed since last call.
   */
  getDocumentId(): string {
    // Check if document has changed (e.g., user opened a different file)
    this._checkDocumentChanged();

    // Return cached ID (initialized in constructor or after document change)
    return this._documentId ?? "word-uuid-stale-" + this._generateUUID();
  }
}

/**
 * Create and register the adapter with the PaperDebugger Web Component
 */
export function createAndRegisterWordAdapter(): WordAdapter {
  const adapter = new WordAdapter();

  // Register with the global registry from paperdebugger webapp
  const win = window as unknown as {
    __pdRegisterAdapter?: (id: string, adapter: DocumentAdapter) => void;
  };

  if (win.__pdRegisterAdapter) {
    win.__pdRegisterAdapter("word-default", adapter);
  }

  return adapter;
}
