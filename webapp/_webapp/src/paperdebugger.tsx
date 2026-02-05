import { Chat } from "./views/chat";
import { Tabs } from "./components/tabs";
import { Settings } from "./views/settings";
import { Prompts } from "./views/prompts";
import { PdAppBodyContainer } from "./components/pd-app-body-container";
import { MessageSquare, Notebook, Settings as SettingsIcon } from "lucide-react";

export const PaperDebugger = () => {
  return (
    <PdAppBodyContainer id="pd-app-body">
      <Tabs
        items={[
          {
            key: "chat",
            title: "Chat",
            icon: <MessageSquare />,
            children: <Chat />,
            tooltip: "Chat",
          },
          {
            key: "prompts",
            title: "Prompts",
            icon: <Notebook />,
            children: <Prompts />,
            tooltip: "Prompt Library",
          },
          {
            key: "settings",
            title: "Settings",
            icon: <SettingsIcon />,
            children: <Settings />,
            tooltip: "Settings",
          },
        ]}
      />
    </PdAppBodyContainer>
  );
};
