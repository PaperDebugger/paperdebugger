import type { DocumentAdapter, SelectionInfo } from "@/adapters";
import { useSelectionStore } from "@/stores/selection-store";

// Global adapter registry for Web Component communication
const adapterRegistry = new Map<string, DocumentAdapter>();

/**
 * Get a registered adapter by id (for use by the Office app component).
 */
export function getAdapter(id: string): DocumentAdapter | undefined {
  return adapterRegistry.get(id);
}

/**
 * Register an adapter instance that can be used by the Web Component.
 * Call this from the host application (Office Add-in) before using the component.
 */
export function registerAdapter(id: string, adapter: DocumentAdapter): void {
  adapterRegistry.set(id, adapter);
}

/**
 * Unregister an adapter.
 */
export function unregisterAdapter(id: string): void {
  adapterRegistry.delete(id);
}

/**
 * Set the current selection from external host (e.g., Office Add-in).
 * @param selection - The selection info, or null to clear
 */
export function setSelection(selection: SelectionInfo | null): void {
  const store = useSelectionStore.getState();
  if (selection) {
    store.setLastSelectedText(selection.text);
    store.setLastSurroundingText(selection.surroundingText ?? null);
    store.setSelectedText(selection.text);
    store.setSurroundingText(selection.surroundingText ?? null);
  } else {
    store.setLastSelectedText(null);
    store.setLastSurroundingText(null);
    store.setSelectedText(null);
    store.setSurroundingText(null);
  }
}

// Expose registration functions globally for cross-bundle access
if (typeof window !== "undefined") {
  (window as unknown as { __pdAdapterRegistry: typeof adapterRegistry }).__pdAdapterRegistry = adapterRegistry;
  (window as unknown as { __pdRegisterAdapter: typeof registerAdapter }).__pdRegisterAdapter = registerAdapter;
  (window as unknown as { __pdUnregisterAdapter: typeof unregisterAdapter }).__pdUnregisterAdapter = unregisterAdapter;
  (window as unknown as { __pdSetSelection: typeof setSelection }).__pdSetSelection = setSelection;
}
