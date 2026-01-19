import r2wc from "@r2wc/react-to-web-component";
import { MainDrawer } from "..";
import { useConversationUiStore } from "../../stores/conversation/conversation-ui-store";
import { useEffect, useMemo, useState } from "react";
import { Providers } from "./providers";
import {
  AdapterProvider,
  type DocumentAdapter,
  type StorageAdapter,
  type SelectionInfo,
} from "../../adapters";
import { setStorage as setGlobalStorage } from "../../libs/storage";
import { useAuthStore } from "../../stores/auth-store";
import { useSelectionStore } from "../../stores/selection-store";
import { useSettingStore } from "../../stores/setting-store";

import "../../index.css";

interface PaperDebuggerProps {
  displayMode?: "floating" | "bottom-fixed" | "right-fixed" | "fullscreen";
  // The adapter can be passed as a serialized object or accessed globally
  // Since Web Components can only receive primitive/string props easily,
  // we'll use a global registry pattern for complex objects
  adapterId?: string;
}

// Global adapter registry for Web Component communication
const adapterRegistry = new Map<string, DocumentAdapter>();

/**
 * Register an adapter instance that can be used by the Web Component
 * Call this from the host application (Office Add-in) before using the component
 */
export function registerAdapter(id: string, adapter: DocumentAdapter): void {
  adapterRegistry.set(id, adapter);
}

/**
 * Unregister an adapter
 */
export function unregisterAdapter(id: string): void {
  adapterRegistry.delete(id);
}

/**
 * Set the storage adapter to be used by PaperDebugger
 * This MUST be called before the component mounts to ensure auth state is properly loaded
 * @param adapter - A StorageAdapter implementation (e.g., OfficeRoamingAdapter)
 */
export function setStorage(adapter: StorageAdapter): void {
  setGlobalStorage(adapter);
}

/**
 * Set the current selection from external host (e.g., Office Add-in)
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
  (window as unknown as { __pdAdapterRegistry: typeof adapterRegistry }).
    __pdAdapterRegistry = adapterRegistry;
  (window as unknown as { __pdRegisterAdapter: typeof registerAdapter }).
    __pdRegisterAdapter = registerAdapter;
  (window as unknown as { __pdUnregisterAdapter: typeof unregisterAdapter }).
    __pdUnregisterAdapter = unregisterAdapter;
  (window as unknown as { __pdSetStorage: typeof setStorage }).
    __pdSetStorage = setStorage;
  (window as unknown as { __pdSetSelection: typeof setSelection }).
    __pdSetSelection = setSelection;
}

const PaperDebugger = ({ displayMode = "fullscreen", adapterId }: PaperDebuggerProps) => {
  const { setDisplayMode, setIsOpen, isOpen } = useConversationUiStore();
  const { initFromStorage: initAuthFromStorage, login } = useAuthStore();
  const { initLocalSettings } = useSettingStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize stores from storage on mount
  // This must happen before the main UI renders to restore login state and settings
  useEffect(() => {
    // Re-initialize auth store from storage (storage adapter should be set by host before component mounts)
    initAuthFromStorage();
    // Re-initialize local UI settings from storage
    initLocalSettings();
    // Attempt to login with restored tokens
    login();
    setIsInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDisplayMode(displayMode);
    setIsOpen(true);
  }, [setIsOpen, isOpen, setDisplayMode, displayMode]);

  // Get adapter from registry (must be registered by the host application)
  const adapter = useMemo<DocumentAdapter | null>(() => {
    if (adapterId) {
      const registeredAdapter = adapterRegistry.get(adapterId);
      if (registeredAdapter) {
        return registeredAdapter;
      }
    }
    // No adapter registered - host application must register one
    console.error(
      "[PaperDebugger] No adapter registered. " +
      "The host application (e.g., Office Add-in) must register an adapter using __pdRegisterAdapter() before loading this component."
    );
    return null;
  }, [adapterId]);

  if (!adapter) {
    return (
      <div style={{ padding: 16, color: "red" }}>
        Error: No document adapter registered. Please ensure the host application registers an adapter.
      </div>
    );
  }

  // Wait for initialization to complete before rendering main UI
  if (!isInitialized) {
    return (
      <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading...
      </div>
    );
  }

  return (
    <Providers>
      <AdapterProvider adapter={adapter}>
        <MainDrawer />
      </AdapterProvider>
    </Providers>
  );
};

// Convert to Web Component with props support
const PaperdebuggerOffice = r2wc(PaperDebugger, {
  props: {
    displayMode: "string",
    adapterId: "string",
  },
});

customElements.define("paperdebugger-office", PaperdebuggerOffice);

// Export for direct module usage
export { PaperDebugger };
