import { useState } from "react";
import { getManifest } from "../../../libs/manifest";
import { ChatButton } from "../../chat/header/chat-button";
import { useSettingStore } from "../../../stores/setting-store";

export const SettingsFooter = () => {
  const manifest = getManifest();
  // @ts-expect-error we don't use this variable versionClickCount
  const [versionClickCount, setVersionClickCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [versionClickTimeout, setVersionClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const { enableUserDeveloperTools, setEnableUserDeveloperTools } = useSettingStore();

  return (
    <div className="pd-end-of-settings flex flex-col items-center justify-center gap-2 mt-8 text-gray-400">
      <div className="flex flex-col items-center justify-center">
        <span className="ml-1 text-exo-2 toolbar-label">
          <span className="font-light">Paper</span>
          <span className="font-bold">Debugger</span>
        </span>
        <div
          className="text-xs font-light select-none"
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
              alert("我们还没有在 App Store 上架");
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
              alert("现在不能评论！因为应用还未上架！");
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
        <a href="https://www.paperdebugger.com/terms/" target="_blank" className="hover:text-primary-600 text-gray-500">
          Terms of Service
        </a>
        <div>|</div>
        <a
          href="https://www.paperdebugger.com/privacy/"
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
