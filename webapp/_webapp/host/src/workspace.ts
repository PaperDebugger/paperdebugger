import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Directories we've already ensured this process, so we mkdir once per project
// rather than on every chat turn.
const ensured = new Set<string>();

// Per-project working directory the CLIs run in, so each Overleaf project is
// isolated (own files, own Claude session / Codex thread on disk).
//   ~/.paperdebugger/workspace/<projectId>/
export function workspaceDir(projectId?: string): string {
  // Sanitize: strip anything that could escape the workspace root (slashes,
  // dots, …). Overleaf ids are hex, so this is just defense-in-depth.
  const safe = (projectId ?? "").replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const dir = path.join(os.homedir(), ".paperdebugger", "workspace", safe);
  if (!ensured.has(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
    ensured.add(dir);
  }
  return dir;
}
