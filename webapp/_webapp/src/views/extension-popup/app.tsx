import { Providers } from "@/providers";
import { ExtensionPopup } from "@/views/extension-popup/components/ExtensionPopup";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <Providers>
        <ExtensionPopup />
      </Providers>
    </StrictMode>
  ) : (
    <Providers>
      <ExtensionPopup />
    </Providers>
  ),
);
