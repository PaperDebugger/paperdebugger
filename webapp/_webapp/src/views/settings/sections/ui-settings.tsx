import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { useSettingStore } from "../../../stores/setting-store";
import { SettingItem } from "../setting-items";

export const UISettings = () => {
  const {
    settings,
    isUpdating,
    updateSettings,
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
        onSelectChange={(selected) => setDisableLineWrap(selected)}
      />
    </SettingsSectionContainer>
  );
};
