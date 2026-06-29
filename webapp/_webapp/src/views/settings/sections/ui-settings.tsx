import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { useSettingStore } from "@/stores/setting-store";
import { SettingItem } from "../setting-items";
import { SettingItemSelect } from "../setting-item-select";
import { onElementAppeared } from "@/libs/helpers";

const THEME_OPTIONS: Record<string, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

export const UISettings = () => {
  const {
    settings,
    isUpdating,
    updateSettings,
    themeMode,
    setThemeMode,
    disableLineWrap,
    setDisableLineWrap,
    minimalistMode,
    setMinimalistMode,
    hideAvatar,
    setHideAvatar,
    allowOutOfBounds,
    setAllowOutOfBounds,
  } = useSettingStore();

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>UI</SettingsSectionTitle>
      <SettingItemSelect
        label="Appearance"
        description="Follow system, light, or dark mode"
        selected={themeMode}
        options={THEME_OPTIONS}
        onSelectChange={(value) => setThemeMode(value as "auto" | "light" | "dark")}
      />
      <SettingItem
        label="Show shortcuts after selecting text"
        description="Display shortcuts after text selection"
        isLoading={isUpdating.showShortcutsAfterSelection}
        selected={settings?.showShortcutsAfterSelection ?? false}
        onSelectChange={(selected) => updateSettings({ showShortcutsAfterSelection: selected })}
      />
      <SettingItem
        label="Full width button"
        description="Affects the top left corner button width"
        isLoading={isUpdating.fullWidthPaperDebuggerButton}
        selected={settings?.fullWidthPaperDebuggerButton ?? false}
        onSelectChange={(selected) => updateSettings({ fullWidthPaperDebuggerButton: selected })}
      />
      <SettingItem
        label="Minimalist mode"
        description="Always collapse the header and footer"
        selected={minimalistMode}
        onSelectChange={(selected) => setMinimalistMode(selected)}
      />
      <SettingItem
        label="Hide avatar"
        description="Hide the avatar in the header"
        selected={hideAvatar}
        onSelectChange={(selected) => setHideAvatar(selected)}
      />
      <SettingItem
        label="Allow window out of bounds"
        description="You can right-click the PaperDebugger button to reset position if the window is lost."
        selected={allowOutOfBounds}
        onSelectChange={(selected) => setAllowOutOfBounds(selected)}
      />
      <SettingItem
        label="Disable line wrap"
        description="Disable Overleaf's line wrap feature."
        selected={disableLineWrap}
        onSelectChange={(selected) => {
          setDisableLineWrap(selected);
          if (selected) {
            onElementAppeared(".cm-lineWrapping", (editor) => {
              editor.classList.remove("cm-lineWrapping");
            });
          } else {
            onElementAppeared(".cm-content", (editor) => {
              editor.classList.add("cm-lineWrapping");
            });
          }
        }}
      />
    </SettingsSectionContainer>
  );
};
