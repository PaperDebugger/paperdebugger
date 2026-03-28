import r2wc from "@r2wc/react-to-web-component";
import { MainDrawer } from "..";
import { useConversationUiStore } from "../../stores/conversation/conversation-ui-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Providers } from "./providers";
import { AdapterProvider, type DocumentAdapter } from "../../adapters";
import { useAuthStore } from "../../stores/auth-store";
import { useSettingStore } from "../../stores/setting-store";
import { useThemeSync } from "../../hooks/useThemeSync";
import { getAdapter } from "./registry";

import "../../index.css";

interface PaperDebuggerProps {
  displayMode?: "floating" | "bottom-fixed" | "right-fixed" | "fullscreen";
  // The adapter can be passed as a serialized object or accessed globally
  // Since Web Components can only receive primitive/string props easily,
  // we'll use a global registry pattern for complex objects
  adapterId?: string;
}

const PaperDebugger = ({ displayMode = "fullscreen", adapterId }: PaperDebuggerProps) => {
  const { setDisplayMode, setIsOpen } = useConversationUiStore();
  const { initFromStorage: initAuthFromStorage, login } = useAuthStore();
  const { initLocalSettings } = useSettingStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const prevDisplayModeRef = useRef<typeof displayMode | null>(null);

  useThemeSync();

  // Sync displayMode prop to store during render (compute during render instead of useEffect)
  if (prevDisplayModeRef.current !== displayMode) {
    prevDisplayModeRef.current = displayMode;
    setDisplayMode(displayMode);
  }

  useThemeSync();

  // Initialize stores from storage on mount
  // This must happen before the main UI renders to restore login state and settings
  useEffect(() => {
    // Re-initialize auth store from storage (storage adapter should be set by host before component mounts)
    initAuthFromStorage();
    // Re-initialize local UI settings from storage
    initLocalSettings();
    // Attempt to login with restored tokens
    login();
    setIsOpen(true);
    setIsInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get adapter from registry (must be registered by the host application)
  const adapter = useMemo<DocumentAdapter | null>(() => {
    if (adapterId) {
      const registeredAdapter = getAdapter(adapterId);
      if (registeredAdapter) {
        return registeredAdapter;
      }
    }
    // No adapter registered - host application must register one
    console.error(
      "[PaperDebugger] No adapter registered. " +
        "The host application (e.g., Office Add-in) must register an adapter using __pdRegisterAdapter() before loading this component.",
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
      <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>
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
