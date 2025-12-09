import { Steps, Step } from "./Steps";

const steps: Step[] = [
  {
    number: 1,
    content: (
      <>
        In{" "}
        <a
          className="step-link"
          href="https://overleaf.com"
          target="_blank"
          rel="noreferrer"
        >
          overleaf.com
        </a>
        , open any of your projects.
      </>
    ),
  },
  {
    number: 2,
    content: <>PaperDebugger is in the "top left" of the project page.</>,
  },
];

export const ExtensionPopup = () => {
  const openSettingsPage = () => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    const url = runtime?.getURL?.("settings.html") ?? "/settings.html";

    if (runtime?.openOptionsPage) {
      runtime.openOptionsPage();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const settingsUrl =
    (typeof chrome !== "undefined" ? chrome.runtime?.getURL?.("settings.html") : undefined) ??
    "/settings.html";

  return (
    <div className="popup-shell">
      <h1 className="title">PaperDebugger</h1>
      <h2 className="subtitle">How to use</h2>
      <Steps steps={steps} />

      <img
        src="images/locator.png"
        alt="PaperDebugger Location"
        style={{
          width: "100%",
        }}
      />

      <p className="footnote" style={{ marginTop: "12px" }}>
        Self-hosted Overleaf?{" "}
        <a
          className="step-link"
          href={settingsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openSettingsPage();
          }}
        >
          Allow PaperDebugger access here.
        </a>
      </p>
    </div>
  );
};
