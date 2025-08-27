import { Extension } from "@codemirror/state";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { OnboardingGuide } from "./components/onboarding-guide";
import { ToolbarButton } from "./components/toolbar-button";
import "./index.css";
import googleAnalytics from "./libs/google-analytics";
import { generateSHA1Hash, onElementAdded, onElementAppeared } from "./libs/helpers";
import { OverleafCodeMirror, completion, createSuggestionExtension } from "./libs/inline-suggestion";
import { logInfo } from "./libs/logger";
import apiclient, { getEndpointFromLocalStorage } from "./libs/apiclient";
import { Providers } from "./providers";
import { useAuthStore } from "./stores/auth-store";
import { useConversationUiStore } from "./stores/conversation/conversation-ui-store";
import { useDevtoolStore } from "./stores/devtool-store";
import { useSelectionStore } from "./stores/selection-store";
import { useSettingStore } from "./stores/setting-store";
import { MainDrawer } from "./views";
import { DevTools } from "./views/devtools";
import { usePromptLibraryStore } from "./stores/prompt-library-store";
import { TopMenuButton } from "./components/top-menu-button";
import { Logo } from "./components/logo";

export const Main = () => {
  const { inputRef, setActiveTab } = useConversationUiStore();
  const {
    lastSelectedText,
    lastSelectionRange,
    setLastSelectedText,
    setLastSelectionRange,
    setSelectedText,
    setSelectionRange,
    clearOverleafSelection,
  } = useSelectionStore();
  const [menuElement, setMenuElement] = useState<Element | null>(null);
  const { isOpen, setIsOpen } = useConversationUiStore();
  const { showTool: showDevTool } = useDevtoolStore();
  const { settings, loadSettings, disableLineWrap } = useSettingStore();
  const { login } = useAuthStore();
  const { loadPrompts } = usePromptLibraryStore();

  useEffect(() => {
    apiclient.updateBaseURL(getEndpointFromLocalStorage());
    login();
    loadSettings();
    loadPrompts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (disableLineWrap) {
      onElementAppeared(".cm-lineWrapping", (editor) => {
        editor.classList.remove("cm-lineWrapping");
        console.log("disable line wrap");
      });
    } else {
      onElementAppeared(".cm-content", (editor) => {
        editor.classList.add("cm-lineWrapping");
        console.log("enable line wrap");
      });
    }
  }, [disableLineWrap]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      // check if the selection is in the editor
      const editor = document.querySelector(".cm-editor");
      if (editor && editor.contains(selection?.anchorNode ?? null)) {
        setLastSelectedText(selection?.toString() ?? null);
        setLastSelectionRange(selection?.getRangeAt(0) ?? null);
        return;
      } else {
        return;
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [setLastSelectedText, setLastSelectionRange]);

  // Add effect to close context menu when clicking outside

  const selectAndOpenPaperDebugger = useCallback(() => {
    setActiveTab("chat");
    setSelectedText(lastSelectedText);
    setSelectionRange(lastSelectionRange);
    setIsOpen(true);
    clearOverleafSelection();
  }, [setSelectedText, setSelectionRange, setIsOpen, lastSelectedText, lastSelectionRange, clearOverleafSelection]);

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
      {import.meta.env.DEV && showDevTool && <DevTools />}
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
    root.render(
      import.meta.env.DEV ? (
        <StrictMode>
          <Providers>
            <Main />
          </Providers>
        </StrictMode>
      ) : (
        <Providers>
          <Main />
        </Providers>
      ),
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
