import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { useSettingStore } from "../../stores/setting-store";
import { UserDeveloperTools } from "./sections/user-developer-tools";
import { AccountSettings } from "./sections/account-settings";
import { UISettings } from "./sections/ui-settings";
import { RealDeveloperTools } from "./sections/real-developer-tools";
import { ApiKeySettings } from "./sections/api-key-settings";
import { cn } from "@/lib/utils";
import { PanelHeader } from "@/components/app-shell/PanelHeader";
import { HeaderMenu } from "@/components/ui/HeaderMenu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Settings = () => {
  const { settings, isLoading, loadSettings, enableUserDeveloperTools, resetSettings } = useSettingStore();

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
    <div className="pd-app-tab-content noselect">
      <div className="pd-app-tab-content-body">
        <div
          className={cn(
            "flex-1 overflow-hidden min-w-0 bg-foreground-2 shadow-middle rounded-l-[14px] rounded-r-[14px]",
          )}
        >
          <div className="h-full flex flex-col">
            <PanelHeader
              title="Settings"
              actions={
                <HeaderMenu>
                  <Button variant="outline" onClick={() => resetSettings()}>
                    Reset Settings
                  </Button>
                </HeaderMenu>
              }
            />
            <div className="flex-1 min-h-0 mask-fade-y">
              <ScrollArea className="h-full">
                <div className="px-5 py-7 max-w-full mx-auto">
                  <div className="space-y-8">
                    <UISettings />
                    <ApiKeySettings />
                    <AccountSettings />
                    {enableUserDeveloperTools && <UserDeveloperTools />}
                    {import.meta.env.DEV && <RealDeveloperTools />}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
