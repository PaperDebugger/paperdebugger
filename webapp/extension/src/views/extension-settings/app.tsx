import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "../../providers";
import { ExtensionSettings } from "./components/ExtensionSettings";
import "../../index.css";

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
