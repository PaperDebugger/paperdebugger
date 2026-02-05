import { useAuthStore } from "../../../stores/auth-store";
import { useEffect, useState } from "react";
import { getCookies } from "../../../intermediate";
import { useAdapterOptional } from "../../../adapters/context";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getManifest } from "../../../libs/manifest";
import { useSettingStore } from "../../..//stores/setting-store";

export const AccountSettings = () => {
  const { logout, user } = useAuthStore();
  const [overleafSession, setOverleafSession] = useState("");
  const [gclb, setGclb] = useState("");
  const adapter = useAdapterOptional();
  const isWord = adapter?.platform === "word";
  const manifest = getManifest();
  // @ts-expect-error we don't use this variable versionClickCount
  const [versionClickCount, setVersionClickCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [versionClickTimeout, setVersionClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const { enableUserDeveloperTools, setEnableUserDeveloperTools } = useSettingStore();
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => {
    return (
      <a href={href} target="_blank" className="hover:text-primary-600">
        {children}
      </a>
    );
  };

  const onVersionClick = () => {
    setVersionClickCount((prev: number) => {
      const next = prev + 1;
      if (next >= 5) {
        setEnableUserDeveloperTools(!enableUserDeveloperTools);
        return 0;
      }
      return next;
    });
    if (versionClickTimeout) {
      clearTimeout(versionClickTimeout);
    }
    const timeout = setTimeout(() => {
      setVersionClickCount(0);
    }, 1500);
    setVersionClickTimeout(timeout);
  };
  useEffect(() => {
    getCookies(window.location.hostname).then((cookies) => {
      setOverleafSession(cookies.session);
      setGclb(cookies.gclb);
    });
  }, []);

  return (
    <SettingsSection title="Account">
      <SettingsCard>
        <SettingsRow label="Status" description="The current status of the app">
          <div className="flex flex-col gap-0 text-xs text-default-500">
            <div className="flex flex-row gap-2 items-center">
              <div className={cn("rounded-full w-2 h-2", user ? "bg-green-500" : "bg-red-500")}></div>User
            </div>
            {!isWord && (
              <>
                <div className="flex flex-row gap-2 items-center">
                  <div
                    className={cn(
                      "rounded-full w-2 h-2",
                      overleafSession && overleafSession.length > 0 ? "bg-green-500" : "bg-red-500",
                    )}
                  ></div>
                  Session
                </div>
                <div className="flex flex-row gap-2 items-center">
                  <div
                    className={cn("rounded-full w-2 h-2", gclb && gclb.length > 0 ? "bg-green-500" : "bg-red-500")}
                  ></div>
                  GCLB
                </div>
              </>
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Logout">
          <Button size="sm" variant="outline" onClick={logout}>
            Log out
          </Button>
        </SettingsRow>
        <SettingsRow label="Version" onClick={onVersionClick}>
          <div className="text-xs font-light select-none flex flex-col gap-1 text-muted-foreground text-right">
            <div className="flex flex-row gap-2 justify-end">
              <div className="ml-1 text-exo-2 toolbar-label">
                <span className="font-light">Paper</span>
                <span className="font-bold">Debugger</span>
              </div>
              {manifest?.version_name || "unknown"}
            </div>
            <div className="flex flex-row gap-2 items-center justify-end">
              <Link href="https://github.com/PaperDebugger/paperdebugger/issues">Feedback</Link>
              <div>|</div>
              <Link href="https://www.paperdebugger.com/blog/terms/">Terms of Service</Link>
              <div>|</div>
              <Link href="https://www.paperdebugger.com/blog/privacy/">Privacy Policy</Link>
            </div>
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
};
