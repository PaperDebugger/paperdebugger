import { Chat } from "./views/chat";
import { Tabs } from "./components/tabs";
import { Settings } from "./views/settings";
import { Prompts } from "./views/prompts";
import { PdAppBodyContainer } from "./components/pd-app-body-container";

export const PaperDebugger = () => {
  return (
    <PdAppBodyContainer id="pd-app-body">
      <Tabs
        items={[
          {
            key: "chat",
            title: "Chat",
            icon: "tabler:message",
            children: <Chat />,
            tooltip: "Chat",
          },
          {
            key: "prompts",
            title: "Prompts",
            icon: "tabler:notebook",
            children: <Prompts />,
            tooltip: "Prompt Library",
          },
          {
            key: "settings",
            title: "Settings",
            icon: "tabler:settings",
            children: <Settings />,
            tooltip: "Settings",
          },
        ]}
      />
    </PdAppBodyContainer>
  );
};
