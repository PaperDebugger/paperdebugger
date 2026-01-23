import { createRoot } from "react-dom/client";
import App from "./app";
import { Main } from "../main";
import { Providers } from "../providers";
import { AdapterProvider, getOverleafAdapter } from "../adapters";

const devTool = createRoot(document.getElementById("root-devtools")!);
devTool.render(<App />);

const paperDebugger = createRoot(document.getElementById("root-paper-debugger")!);
const adapter = getOverleafAdapter();
paperDebugger.render(
  <Providers>
    <AdapterProvider adapter={adapter}>
      <Main />
    </AdapterProvider>
  </Providers>,
);
