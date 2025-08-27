import { createRoot } from "react-dom/client";
import App from "./app";
import { Main } from "../main";
import { Providers } from "../providers";

const devTool = createRoot(document.getElementById("root-devtools")!);
devTool.render(<App />);

const paperDebugger = createRoot(document.getElementById("root-paper-debugger")!);
paperDebugger.render(
  <Providers>
    <Main />
  </Providers>,
);
