/**
 * Adapter Type Definitions
 *
 * ⚠️  AUTO-SYNCED FROM WEBAPP - DO NOT EDIT DIRECTLY
 *
 * This file is synced from paperdebugger webapp.
 * To make changes, edit the source file in webapp and run:
 *   ./scripts/sync-types.sh
 *
 * Source: paperdebugger/webapp/_webapp/src/adapters/types.ts
 * Last synced: 2026-01-12 06:03:56 UTC
 */

// ============================================================================
// Document Adapter Types
// ============================================================================

export interface SelectionInfo {
  /** The selected text content */
  text: string;
  /** Optional surrounding text for context (with markers like [SELECTED_TEXT_START] and [SELECTED_TEXT_END]) */
  surroundingText?: string;
  /** Platform-specific range identifier for later operations */
  rangeId?: string;
}

export interface DocumentAdapter {
  /**
   * Platform identifier for conditional UI rendering
   */
  readonly platform: "overleaf" | "word" | "browser";

  /**
   * Get the full document text
   */
  getFullText(): Promise<string>;

  /**
   * Get the currently selected text and its context
   */
  getSelection(): Promise<SelectionInfo | null>;

  /**
   * Insert text at the current cursor position
   * @param text - Text to insert
   * @param location - Optional: 'cursor' (default), 'start', or 'end'
   */
  insertText(text: string, location?: "cursor" | "start" | "end"): Promise<void>;

  /**
   * Replace the current selection with new text
   * @param text - Text to replace with
   * @param rangeId - Optional range identifier from getSelection()
   */
  replaceSelection(text: string, rangeId?: string): Promise<void>;

  /**
   * Subscribe to selection change events
   * @param callback - Called when selection changes
   * @returns Cleanup function to unsubscribe
   */
  onSelectionChange?(callback: (selection: SelectionInfo | null) => void): () => void;

  /**
   * Check if the adapter is ready/connected
   */
  isReady(): boolean;

  /**
   * Optional: Get project/document identifier
   */
  getDocumentId?(): string;
}

/**
 * Type for adapter props passed to Web Component
 */
export interface AdapterProps {
  adapter?: DocumentAdapter;
  displayMode?: "floating" | "bottom-fixed" | "right-fixed" | "fullscreen";
}

// ============================================================================
// Storage Adapter Types
// ============================================================================

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  /** Get all keys in storage */
  keys(): string[];
}
