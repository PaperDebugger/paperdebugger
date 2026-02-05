import { ThemeMode, useSettingStore } from "../../../stores/setting-store";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsToggle } from "@/components/settings/SettingsToggle";
import { SettingsSegmentedControl } from "@/components/settings/SettingsSegmentedControl";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const handleThemeModeChange = (value: string) => {
    setThemeMode(value as ThemeMode);
  };
  return (
    <SettingsSection title="Appearance" icon={<Palette className="w-4 h-4" />}>
      <SettingsCard>
        <SettingsRow label="Color theme">
          <SettingsSegmentedControl
            value={themeMode}
            onValueChange={handleThemeModeChange}
            options={[
              { value: "auto", label: "System", icon: <Monitor className="w-4 h-4" /> },
              { value: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
              { value: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
            ]}
          />
        </SettingsRow>
        <SettingsToggle
          label="Show shortcuts after selecting text"
          description="Display shortcuts after text selection"
          checked={settings?.showShortcutsAfterSelection ?? false}
          disabled={isUpdating.showShortcutsAfterSelection}
          loading={isUpdating.showShortcutsAfterSelection}
          onCheckedChange={() =>
            updateSettings({ showShortcutsAfterSelection: !settings?.showShortcutsAfterSelection })
          }
        />
        <SettingsToggle
          label="Full width button"
          description="Affects the top left corner button width"
          checked={settings?.fullWidthPaperDebuggerButton ?? true}
          disabled={isUpdating.fullWidthPaperDebuggerButton}
          loading={isUpdating.fullWidthPaperDebuggerButton}
          onCheckedChange={() =>
            updateSettings({ fullWidthPaperDebuggerButton: !settings?.fullWidthPaperDebuggerButton })
          }
        />
        <SettingsToggle
          label="Minimalist mode"
          description="Always collapse the header and footer"
          checked={minimalistMode}
          onCheckedChange={() => setMinimalistMode(!minimalistMode)}
        />
        <SettingsToggle
          label="Hide avatar"
          description="Hide the avatar in the header"
          checked={hideAvatar}
          onCheckedChange={() => setHideAvatar(!hideAvatar)}
        />
        <SettingsToggle
          label="Allow window out of bounds"
          description="You can right-click the PaperDebugger button to reset position if the window is lost."
          checked={allowOutOfBounds}
          onCheckedChange={() => setAllowOutOfBounds(!allowOutOfBounds)}
        />
        <SettingsToggle
          label="Disable line wrap"
          description="Disable Overleaf's line wrap feature."
          checked={disableLineWrap}
          onCheckedChange={() => setDisableLineWrap(!disableLineWrap)}
        />
      </SettingsCard>
    </SettingsSection>
  );
};
