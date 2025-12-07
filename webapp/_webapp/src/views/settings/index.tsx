import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { useSettingStore } from "../../stores/setting-store";

import { SettingsHeader } from "./settings-header";
import { UserDeveloperTools } from "./sections/user-developer-tools";
import { AccountSettings } from "./sections/account-settings";
import { UISettings } from "./sections/ui-settings";
import { RealDeveloperTools } from "./sections/real-developer-tools";
import { SettingsFooter } from "./sections/footer";

export const Settings = () => {
  const { settings, isLoading, loadSettings, enableUserDeveloperTools } = useSettingStore();

  useEffect(() => {
    if (!settings) {
      loadSettings();
    }
  }, [settings, loadSettings]);

  if (isLoading || settings === null) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <Spinner color="default" variant="gradient" />
      </div>
    );
  }

  return (
    <div className="pd-app-tab-content noselect !min-w-[400px]">
      <SettingsHeader />
      <div className="pd-app-tab-content-body">
        <UISettings />
        {/* <BetaFeatureSettings /> */}
        <AccountSettings />
        <SettingsFooter />
        {enableUserDeveloperTools && <UserDeveloperTools />}
        {import.meta.env.DEV && <RealDeveloperTools />}
      </div>
    </div>
  );
};
