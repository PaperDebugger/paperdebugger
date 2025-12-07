import { Button, cn } from "@heroui/react";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import CellWrapper from "../../../components/cell-wrapper";
import { useSettingStore } from "../../../stores/setting-store";
import { useAuthStore } from "../../../stores/auth-store";
import { useEffect, useState } from "react";
import { getCookies } from "../../../intermediate";

export const AccountSettings = () => {
  const { updateSettings } = useSettingStore();
  const { logout, user } = useAuthStore();
  const [overleafSession, setOverleafSession] = useState("");
  const [gclb, setGclb] = useState("");

  useEffect(() => {
    getCookies(window.location.hostname).then((cookies) => {
      setOverleafSession(cookies.session);
      setGclb(cookies.gclb);
    });
  }, []);

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Account</SettingsSectionTitle>
      <CellWrapper>
        <div className="flex flex-col">
          <div className="text-sm">View onboarding guide</div>
          <div className="text-xs text-default-500">Learn how to use PaperDebugger effectively</div>
        </div>
        <Button
          size="sm"
          color="primary"
          radius="full"
          onPress={() => {
            updateSettings({ showedOnboarding: false });
          }}
        >
          View
        </Button>
      </CellWrapper>
      <CellWrapper>
        <div className="flex flex-col flex-1">
          <div className="text-sm">Status</div>
          <div className="text-xs text-default-500">The current status of the app</div>
        </div>
        <div className="flex flex-col gap-0 text-xs text-default-500">
          <div className="flex flex-row gap-2 items-center">
            <div className={cn("rounded-full w-2 h-2", user ? "bg-primary-500" : "bg-red-500")}></div>User
          </div>
          <div className="flex flex-row gap-2 items-center">
            <div
              className={cn(
                "rounded-full w-2 h-2",
                overleafSession && overleafSession.length > 0 ? "bg-primary-500" : "bg-red-500",
              )}
            ></div>
            Session
          </div>
          <div className="flex flex-row gap-2 items-center">
            <div
              className={cn("rounded-full w-2 h-2", gclb && gclb.length > 0 ? "bg-primary-500" : "bg-red-500")}
            ></div>
            GCLB
          </div>
        </div>
      </CellWrapper>
      <CellWrapper>
        <div className="flex flex-col">
          <div className="text-sm">Log out</div>
          <div className="text-xs text-default-500">Log out of your account and clear all your data</div>
        </div>
        <Button size="sm" color="danger" radius="full" variant="flat" onPress={logout}>
          Log out
        </Button>
      </CellWrapper>
    </SettingsSectionContainer>
  );
};
