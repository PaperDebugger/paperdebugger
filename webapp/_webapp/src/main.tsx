import type { Extension } from "@codemirror/state";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { OnboardingGuide } from "./components/onboarding-guide";
import { ToolbarButton } from "./components/toolbar-button";
import "./index.css";
import googleAnalytics from "./libs/google-analytics";
import { generateSHA1Hash, onElementAdded, onElementAppeared } from "./libs/helpers";
import { OverleafCodeMirror, completion, createSuggestionExtension } from "./libs/inline-suggestion";
import { logInfo } from "./libs/logger";
import apiclient, { apiclientV2, getEndpointFromLocalStorage } from "./libs/apiclient";
import { Providers } from "./providers";
import { useAuthStore } from "./stores/auth-store";
import { useConversationUiStore } from "./stores/conversation/conversation-ui-store";
import { useSelectionStore } from "./stores/selection-store";
import { useSettingStore } from "./stores/setting-store";
import { useThemeSync } from "./hooks/useThemeSync";
import { MainDrawer } from "./views";
import { usePromptLibraryStore } from "./stores/prompt-library-store";
import { TopMenuButton } from "./components/top-menu-button";
import { Logo } from "./components/logo";
import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import { getManifest } from "./libs/manifest";
import { AdapterProvider, getOverleafAdapter } from "./adapters";

initializeFaro({
  url: "https://faro-collector-prod-ap-southeast-1.grafana.net/collect/79c7648395df4df8b58c228fad42af57",
  app: {
    name: getManifest().name,
    version: getManifest().version,
    environment: "production",
  },
  sessionTracking: {
    samplingRate: 1,
    persistent: true,
  },
  instrumentations: [
    // Mandatory, omits default instrumentations otherwise.
    ...getWebInstrumentations(),

    // Tracing package to get end-to-end visibility for HTTP requests.
    new TracingInstrumentation(),
  ],
  ignoreUrls: [
    /overleaf\.com/,
    /compiles\.overleafusercontent\.com/,
    /writefull\.ai/,
    /bugsnag\.com/,
    /google-analytics\.com/,
  ],
});

export const Main = () => {
  const { inputRef, setActiveTab } = useConversationUiStore();
  const {
    lastSelectedText,
    lastSurroundingText,
    lastSelectionRange,
    setLastSelection,
    setSelectedText,
    setSurroundingText,
    setSelectionRange,
    clearOverleafSelection,
  } = useSelectionStore();
  const [menuElement, setMenuElement] = useState<Element | null>(null);
  const { isOpen, setIsOpen } = useConversationUiStore();
  const { settings, loadSettings, initLocalSettings } = useSettingStore();
  const { login } = useAuthStore();
  const { loadPrompts } = usePromptLibraryStore();

  useThemeSync();

  useEffect(() => {
    apiclient.updateBaseURL(getEndpointFromLocalStorage(), "v1");
    apiclientV2.updateBaseURL(getEndpointFromLocalStorage(), "v2");
    initLocalSettings();
    login();
    loadSettings();
    loadPrompts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      // check if the selection is in the editor
      const editor = document.querySelector(".cm-editor");
      if (editor && editor.contains(selection?.anchorNode ?? null)) {
        const text = selection?.toString() ?? null;

        let surrounding = "";
        try {
          const cmContentElement = document.querySelector(".cm-content");
          if (cmContentElement) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state = (cmContentElement as any).cmView.view.state;
            if (state) {
              const cmSelection = state.selection.main;
              const doc = state.doc;
              const before = doc.sliceString(Math.max(0, cmSelection.from - 100), cmSelection.from);
              const after = doc.sliceString(cmSelection.to, Math.min(doc.length, cmSelection.to + 100));
              surrounding = `${before}[SELECTED_TEXT_START]${text}[SELECTED_TEXT_END]${after}`;
            }
          }
        } catch {
          // fallback
        }

        setLastSelection(text, surrounding, selection?.getRangeAt(0) ?? null);
        return;
      } else {
        return;
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [setLastSelection]);

  // Add effect to close context menu when clicking outside

  const selectAndOpenPaperDebugger = useCallback(() => {
    setActiveTab("chat");
    setSelectedText(lastSelectedText);
    setSurroundingText(lastSurroundingText);
    setSelectionRange(lastSelectionRange);
    setIsOpen(true);
    clearOverleafSelection();
  }, [
    setActiveTab,
    setSelectedText,
    setSurroundingText,
    setSelectionRange,
    setIsOpen,
    lastSelectedText,
    lastSurroundingText,
    lastSelectionRange,
    clearOverleafSelection,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "l") {
        setIsOpen(!isOpen);
        inputRef.current?.focus();
        event.preventDefault();
        event.stopPropagation();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        selectAndOpenPaperDebugger();
        inputRef.current?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setIsOpen, isOpen, inputRef, selectAndOpenPaperDebugger]);

  useEffect(() => {
    onElementAdded(".review-tooltip-menu", (element) => {
      setMenuElement(element);
    });
  }, []);

  const anchorElement =
    document.querySelector(".toolbar-left") || document.querySelector(".ide-redesign-toolbar-menu-bar");
  if (!anchorElement) {
    return (
      <div className="text-sm text-red-500 font-bold">
        PaperDebugger cannot find the anchor element. Please check if the page correctly loaded.
      </div>
    );
  }

  const buttonPortal = createPortal(<TopMenuButton />, anchorElement);

  return (
    <>
      {menuElement &&
        settings?.showShortcutsAfterSelection &&
        createPortal(
          <ToolbarButton
            onClick={() => {
              selectAndOpenPaperDebugger();
              useConversationUiStore.getState().inputRef.current?.focus();
            }}
          >
            <div className="flex flex-row items-center gap-0">
              <Logo className="bg-transparent p-0 m-0 flex items-center justify-center w-6 h-6 align-middle" />
              <p>Add to Chat</p>
              <p className="ml-1 text-xs text-white bg-gray-700 rounded-md px-1 py-0.5 ml-0.5">⌘ + K</p>
            </div>
          </ToolbarButton>,
          menuElement,
        )}

      {buttonPortal}
      <MainDrawer />
      <OnboardingGuide />
    </>
  );
};

if (!import.meta.env.DEV) {
  onElementAppeared(".toolbar-left .toolbar-item, .ide-redesign-toolbar-menu-bar", () => {
    logInfo("initializing");
    if (document.getElementById("paper-debugger-root")) {
      logInfo("already initialized");
      return;
    }
    const div = document.createElement("div");
    div.id = "paper-debugger-root";
    document.body.appendChild(div);

    const root = createRoot(div);
    const adapter = getOverleafAdapter();
    useSettingStore.getState().initLocalSettings();
    // This block only runs in production (!DEV), so always render without StrictMode
    root.render(
      <Providers>
        <AdapterProvider adapter={adapter}>
          <Main />
        </AdapterProvider>
      </Providers>,
    );
    googleAnalytics.firePageViewEvent(
      "unknown",
      "anonymous-" + generateSHA1Hash(document.title),
      document.location.href,
    );
    logInfo("initialized");
  });
}

window.addEventListener("UNSTABLE_editor:extensions", (event: Event) => {
  const customEvent = event as CustomEvent;
  const extensions: Extension[] = customEvent.detail.extensions;
  const codeMirror: OverleafCodeMirror = customEvent.detail.CodeMirror;

  useSelectionStore.getState().setOverleafCm(codeMirror);
  const extension = createSuggestionExtension(codeMirror, {
    acceptOnClick: true,
    debounce: 500,
    completion: completion,
  });
  extensions.push(extension);
});
