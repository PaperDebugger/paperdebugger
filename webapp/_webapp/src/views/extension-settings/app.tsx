import "@/index.css";
import { Providers } from "@/providers";
import { ExtensionSettings } from "@/views/extension-settings/components/ExtensionSettings";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <Providers>
        <ExtensionSettings />
      </Providers>
    </StrictMode>
  ) : (
    <Providers>
      <ExtensionSettings />
    </Providers>
  ),
);
