// Import and register adapter before loading the Web Component
import { createAndRegisterWordAdapter, type SelectionInfo } from "../adapters";
import { OfficeRoamingAdapter, type StorageAdapter } from "../adapters/storage-adapter";

// Inject PaperDebugger as web component
import "../paperdebugger/office";

import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import VConsole from 'vconsole';

/* global document, Office, module, require, HTMLElement */

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;
const vConsole = new VConsole();

// Type for the global PaperDebugger functions
declare global {
  interface Window {
    __pdSetStorage?: (adapter: StorageAdapter) => void;
    __pdSetSelection?: (selection: SelectionInfo | null) => void;
  }
}

/* Render application after Office initializes */
Office.onReady(() => {
  // 1. Create and register the storage adapter FIRST
  // This ensures auth tokens are loaded from Office roaming settings
  const storageAdapter = new OfficeRoamingAdapter();
  if (window.__pdSetStorage) {
    window.__pdSetStorage(storageAdapter);
    console.log("[Office Add-in] Registered OfficeRoamingAdapter with PaperDebugger");
  } else {
    console.warn("[Office Add-in] __pdSetStorage not available - storage may not persist");
  }

  // 2. Create and register the Word document adapter
  // This must happen after Office.onReady but before rendering the component
  const wordAdapter = createAndRegisterWordAdapter();

  // 3. Set up selection change listener
  // This monitors Word document selection and notifies PaperDebugger
  wordAdapter.onSelectionChange((selection) => {
    if (window.__pdSetSelection) {
      window.__pdSetSelection(selection);
    }
  });

  // 4. Render the app
  root?.render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(NextApp);
  });
}
