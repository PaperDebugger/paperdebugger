import r2wc from "@r2wc/react-to-web-component";
import { MainDrawer } from "..";
import { useConversationUiStore } from "../../stores/conversation/conversation-ui-store";
import { useEffect } from "react";
import { Providers } from "./providers";

import "../../index.css";

const PaperDebugger = () => {
  const { setDisplayMode, setIsOpen, isOpen } = useConversationUiStore();
  useEffect(() => {
    setDisplayMode("fullscreen");
    setIsOpen(true);
  }, [setIsOpen, isOpen]);

  return (
    <Providers>
      <MainDrawer />
    </Providers>
  );
};

const PaperdebuggerOffice = r2wc(PaperDebugger);
customElements.define("paperdebugger-office", PaperdebuggerOffice);
