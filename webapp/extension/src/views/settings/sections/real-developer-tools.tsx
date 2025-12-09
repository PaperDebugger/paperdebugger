import { Button, cn } from "@heroui/react";
import CellWrapper from "../../../components/cell-wrapper";
import { SettingItemSelect } from "../setting-item-select";
import { SettingsSectionContainer } from "./components";

import { SettingsSectionTitle } from "./components";
import { SettingItem } from "../setting-items";
import { localStorageKey, useDevtoolStore } from "../../../stores/devtool-store";

export const RealDeveloperTools = () => {
  const {
    showTool: enabled,
    setShowTool,
    slowStreamingMode,
    setSlowStreamingMode,
    alwaysSyncProject,
    setAlwaysSyncProject,
  } = useDevtoolStore();

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>
        <b className="text-red-600">Real</b> Developer Tools *
      </SettingsSectionTitle>
      <SettingItemSelect
        label="Responding Language"
        description="PaperDebugger will think in English and respond in your language"
        selected="en_US"
        options={{
          en_US: "English (US)",
          fr_FR: "Français",
          ja_JP: "日本語",
          ko_KR: "한국어",
          it_IT: "Italiano",
          zh_CN: "简体中文",
          zh_TW: "繁體中文",
        }}
        onSelectChange={() => {
          // console.log("Response Language")
        }}
      />
      <SettingItemSelect
        label="Thinking Mode"
        description="How AI understands your paper. Lite mode does not read your paper. Scholar mode is reading your paper."
        selected="lite"
        options={{
          lite: "Lite",
          scholar: "Scholar (default)",
        }}
        onSelectChange={() => {
          // console.log("Response Language")
        }}
      />
      <SettingItem
        className={cn("transition-all duration-400", enabled ? "bg-purple-100" : "")}
        label="Advanced tools"
        color="secondary"
        description="Testing for conversation, streaming, and more..."
        selected={enabled}
        onSelectChange={(selected) => setShowTool(selected)}
      />
      <SettingItem
        className={cn("transition-all duration-400", slowStreamingMode ? "bg-purple-100" : "")}
        label="Slow streaming mode"
        color="secondary"
        description="Slow down the stream processing speed to 500ms per chunk. Note: This will not slow down the network speed."
        selected={slowStreamingMode}
        onSelectChange={(selected) => setSlowStreamingMode(selected)}
      />
      <SettingItem
        className={cn("transition-all duration-400", alwaysSyncProject ? "bg-purple-100" : "")}
        label="Always sync project"
        color="secondary"
        description="Always sync overleaf project before sending a message. Warning: please test it in a small project."
        selected={alwaysSyncProject}
        onSelectChange={(selected) => setAlwaysSyncProject(selected)}
      />
      <CellWrapper>
        <div className="flex flex-col">
          <div className="text-sm">Reset localStorage and reload</div>
          <div className="text-xs text-default-500">
            Reset all user-configurable localStorage of the app except the: <br />
            pd.projectId
            <br />
            pd.auth.*
            <br />
            pd.devtool.*
            <br />
          </div>
        </div>
        <Button
          size="sm"
          color="secondary"
          radius="full"
          onPress={() => {
            const refreshToken = localStorage.getItem("pd.auth.refreshToken");
            const token = localStorage.getItem("pd.auth.token");
            const gclb = localStorage.getItem("pd.auth.gclb");
            const overleafSession = localStorage.getItem("pd.auth.overleafSession");
            const projectId = localStorage.getItem("pd.projectId");
            const keys = Object.values(localStorageKey);
            const values = keys.map((key) => localStorage.getItem(key));
            localStorage.clear();

            localStorage.setItem("pd.auth.refreshToken", refreshToken || "");
            localStorage.setItem("pd.auth.token", token || "");
            localStorage.setItem("pd.auth.gclb", gclb || "");
            localStorage.setItem("pd.auth.overleafSession", overleafSession || "");
            localStorage.setItem("pd.projectId", projectId || "");

            keys.forEach((key, index) => {
              localStorage.setItem(key, values[index] || "");
            });

            window.location.reload();
          }}
        >
          Reset
        </Button>
      </CellWrapper>
      <div className="text-gray-500 text-xs ps-2">* Only visible in development mode</div>
    </SettingsSectionContainer>
  );
};
