/**
 * Office Add-in Taskpane Entry Point
 *
 * Note: Document operations are now handled through the WordAdapter.
 * This file is kept for any taskpane-specific functionality that doesn't
 * go through the PaperDebugger Web Component.
 */

/* global console */

/**
 * @deprecated Use WordAdapter.insertText instead
 * This is kept for backward compatibility but should not be used directly.
 */
export async function insertText(text: string) {
  console.warn(
    "Direct insertText is deprecated. Use the WordAdapter through the PaperDebugger component instead."
  );

  // Import dynamically to avoid circular dependencies
  const { WordAdapter } = await import("../adapters");
  const adapter = new WordAdapter();
  await adapter.insertText(text, "end");
}
