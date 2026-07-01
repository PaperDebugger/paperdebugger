#!/usr/bin/env node
// Install the native-messaging manifest so the browser can launch this host.
//
//   bun host/src/install.ts            # one-liner: auto-installs deps, runs host via bun
//   node host/dist/install.js          # after `npm run build`, runs host via node
//   …[extension-id] [--browser=chrome|chrome-for-testing|chrome-for-testing-alt|wxt|chromium|edge|brave|vivaldi|opera|arc]
//
// With no args it installs into EVERY detected Chromium-family browser (+ the
// WXT dev profile) and uses the pinned-key extension id. Pass --browser to
// target just one.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.paperdebugger.host";
// Deterministic id from the pinned manifest key (see wxt.config.ts).
const DEFAULT_EXTENSION_ID = "dfkedikhakpapbfcnbpmfhpklndgiaog";

const here = path.dirname(fileURLToPath(import.meta.url)); // host/src (bun) or host/dist (node)
const hostRoot = path.resolve(here, "..");
const isBun = !!process.versions.bun;
// What Chrome's launcher execs: bun runs the .ts directly; node needs the build.
const hostEntry = path.join(here, isBun ? "native.ts" : "native.js");

// The host needs its deps (claude-agent-sdk) to run. Install them once if missing
// so `bun host/src/install.ts` is a true one-liner.
if (!fs.existsSync(path.join(hostRoot, "node_modules"))) {
  console.log("Installing host dependencies…");
  const [cmd, ...cmdArgs] = isBun ? [process.execPath, "install"] : ["npm", "install"];
  execFileSync(cmd, cmdArgs, { cwd: hostRoot, stdio: "inherit" });
}

const args = process.argv.slice(2);
const extensionId = args.find((a) => !a.startsWith("--")) ?? DEFAULT_EXTENSION_ID;
const onlyBrowser = args
  .find((a) => a.startsWith("--browser="))
  ?.split("=")[1]
  ?.toLowerCase();

if (!/^[a-p]{32}$/.test(extensionId)) {
  console.error(
    "Usage: node dist/install.js [extension-id] [--browser=chrome|chrome-for-testing|chrome-for-testing-alt|wxt|chromium|edge|brave|vivaldi|opera|arc]",
  );
  process.exit(1);
}

// GUI-launched browsers get a minimal PATH that usually lacks Homebrew's
// node/bun, so a bare `env node` would fail. Launch via the absolute runtime
// path (process.execPath = the bun or node that ran this installer).
const launcher = path.join(here, "pd-host-launcher.sh");
// stderr → log file so `[pd-host]`/`[codex]` diagnostics survive GUI-launched
// Chrome (which otherwise swallows the host's stderr). stdout is the native
// wire — never redirect it. ponytail: append-only, delete the log if it grows.
const logDir = path.join(os.homedir(), ".paperdebugger");
fs.mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, "pd-host.log");
fs.writeFileSync(
  launcher,
  `#!/bin/bash\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(hostEntry)} "$@" 2>>${JSON.stringify(logPath)}\n`,
);
fs.chmodSync(launcher, 0o755);
if (!isBun) fs.chmodSync(hostEntry, 0o755);

// Per-browser profile dir (parent of NativeMessagingHosts), by platform.
const layouts: Record<string, Record<string, string>> = {
  darwin: {
    chrome: "Google/Chrome",
    // wxt/web-ext dev launches "Google Chrome for Testing", which reads its own
    // native-messaging dir (fixed by product name, not --user-data-dir).
    "chrome-for-testing": "Google/Chrome for Testing",
    // Some Chrome-for-Testing installs use the bundle-id-derived app support dir.
    "chrome-for-testing-alt": "Google/ChromeForTesting",
    chromium: "Chromium",
    edge: "Microsoft Edge",
    brave: "BraveSoftware/Brave-Browser",
    vivaldi: "Vivaldi",
    opera: "com.operasoftware.Opera",
    arc: "Arc/User Data",
  },
  linux: {
    chrome: "google-chrome",
    chromium: "chromium",
    edge: "microsoft-edge",
    brave: "BraveSoftware/Brave-Browser",
    vivaldi: "vivaldi",
    opera: "com.operasoftware.Opera",
  },
};

const map = layouts[process.platform];
if (!map) {
  console.error(`unsupported platform: ${process.platform} (manual install needed)`);
  process.exit(1);
}
const base =
  process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support")
    : path.join(os.homedir(), ".config");

const manifest = {
  name: HOST_NAME,
  description: "PaperDebugger local host (Claude Code / Codex CLI bridge)",
  type: "stdio",
  path: launcher,
  allowed_origins: [`chrome-extension://${extensionId}/`],
};

const entries: Array<[string, string]> = Object.entries(map).map(([name, sub]) => [name, path.join(base, sub)]);

// WXT/web-ext launches Chrome for Testing with --user-data-dir=.wxt/chrome-data.
// That profile can have its own NativeMessagingHosts lookup directory.
const wxtProfileDir = path.resolve(here, "..", "..", ".wxt", "chrome-data");
entries.push(["wxt", wxtProfileDir]);

const targets = entries.filter(([name]) => !onlyBrowser || name === onlyBrowser);
let installed = 0;
for (const [name, profileDir] of targets) {
  // Install where the browser is present (or always, if explicitly targeted).
  if (!onlyBrowser && !fs.existsSync(profileDir)) continue;
  const dir = path.join(profileDir, "NativeMessagingHosts");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  console.log(`✓ ${name.padEnd(9)} ${path.join(dir, `${HOST_NAME}.json`)}`);
  installed += 1;
}

if (installed === 0) {
  console.error("No target browsers found. Pass --browser=<name> to force one.");
  process.exit(1);
}
console.log(`\nlauncher: ${launcher}`);
console.log(`extension: ${extensionId}`);
console.log("Reload the extension, then: chat → Settings → Local host → Test connection.");
