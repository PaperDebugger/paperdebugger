import { getManifest } from "@/libs/manifest";
import { useSettingStore } from "@/stores/setting-store";
import { ChatButton } from "@/views/chat/header/chat-button";
import { useState } from "react";

export const SettingsFooter = () => {
  const manifest = getManifest();
  // @ts-expect-error we don't use this variable versionClickCount
  const [versionClickCount, setVersionClickCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [versionClickTimeout, setVersionClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const { enableUserDeveloperTools, setEnableUserDeveloperTools } = useSettingStore();

  return (
    <div className="pd-end-of-settings flex flex-col items-center justify-center gap-2 mt-8 text-default-400 dark:!text-default-500">
      <div className="flex flex-col items-center justify-center">
        <span className="ml-1 text-exo-2 toolbar-label">
          <span className="font-light">Paper</span>
          <span className="font-bold">Debugger</span>
        </span>
        <div
          className="text-xs font-light select-none"
          role="button"
          tabIndex={0}
          onClick={() => {
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
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
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
            }
          }}
        >
          version:{" "}
          {manifest?.version && manifest?.version_name ? `${manifest.version}, ${manifest.version_name}` : "unknown"}
        </div>
      </div>
      <div className="mx-auto mt-2 flex flex-row gap-2 items-center justify-center">
        {process.env.SAFARI_BUILD === "false" && (
          <ChatButton
            icon="tabler:brand-chrome"
            text="Chrome Web Store"
            alwaysShowText
            onClick={() => {
              window.open(
                "https://chromewebstore.google.com/detail/paperdebugger/dfkedikhakpapbfcnbpmfhpklndgiaog",
                "_blank",
              );
            }}
          />
        )}
        {process.env.SAFARI_BUILD === "true" && (
          <ChatButton
            icon="tabler:brand-appstore"
            text="App Store"
            alwaysShowText
            onClick={() => {
              alert("We are not yet listed on the App Store");
            }}
          />
        )}
        {process.env.SAFARI_BUILD === "false" && (
          <ChatButton
            icon="tabler:mood-edit"
            text="Like Us"
            alwaysShowText
            onClick={() => {
              window.open(
                "https://chromewebstore.google.com/detail/PaperDebugger/dfkedikhakpapbfcnbpmfhpklndgiaog/reviews",
                "_blank",
              );
            }}
          />
        )}
        {process.env.SAFARI_BUILD === "true" && (
          <ChatButton
            icon="tabler:mood-edit"
            text="Like Us"
            alwaysShowText
            onClick={() => {
              alert("Cannot leave a review now! The app is not yet listed!");
              // window.open(
              //   "https://apps.apple.com/cn/app/",
              //   "_blank",
              // );
            }}
          />
        )}
        <ChatButton
          icon="tabler:message-exclamation"
          text="Feedback"
          alwaysShowText
          onClick={() => {
            window.open("https://forms.gle/Zb6LmoVBi5LSG6Ur6", "_blank");
          }}
        />
      </div>
      <div className="mx-auto text-xs text-gray-500 flex flex-row gap-2 items-center justify-center">
        <a href="https://paperdebugger.com" target="_blank" className="hover:text-primary-600 text-gray-500">
          Website
        </a>
        <div>|</div>
        <a
          href="https://www.paperdebugger.com/blog/terms/"
          target="_blank"
          className="hover:text-primary-600 text-gray-500"
        >
          Terms of Service
        </a>
        <div>|</div>
        <a
          href="https://www.paperdebugger.com/blog/privacy/"
          target="_blank"
          className="hover:text-primary-600 text-gray-500"
        >
          Privacy Policy
        </a>
      </div>
      <div className="mx-auto text-xs text-gray-400">All rights reserved.</div>
    </div>
  );
};
