import { Button, cn } from "@heroui/react";
import CellWrapper from "../../../components/cell-wrapper";
import { SettingItemSelect } from "../setting-item-select";
import { SettingsSectionContainer } from "./components";

import { SettingsSectionTitle } from "./components";
import { SettingItem } from "../setting-items";
import { useDevtoolStore } from "../../../stores/devtool-store";
import { storage } from "../../../libs/storage";

// Keys to preserve during reset
const PRESERVED_KEY_PREFIXES = [
  "pd.auth.",
  "pd.devtool.",
  "pd.projectId",
];

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
          <div className="text-xs">Reset storage and reload</div>
          <div className="text-xs text-default-500">
            Reset all user-configurable storage of the app except: <br />
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
            // Get all keys from storage
            const allKeys = storage.keys();
            
            // Identify keys to preserve (auth, devtool, projectId)
            const keysToPreserve = allKeys.filter((key) =>
              PRESERVED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
            );
            
            // Save values of keys to preserve
            const preservedValues: Record<string, string | null> = {};
            keysToPreserve.forEach((key) => {
              preservedValues[key] = storage.getItem(key);
            });
            
            // Clear all storage
            storage.clear();
            
            // Restore preserved values
            Object.entries(preservedValues).forEach(([key, value]) => {
              if (value !== null) {
                storage.setItem(key, value);
              }
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
