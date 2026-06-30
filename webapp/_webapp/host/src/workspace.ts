import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Shared working directory the CLIs run in. Per-conversation isolation can be
// layered on later by appending the conversation id.
export function workspaceDir(): string {
  const dir = path.join(os.homedir(), ".paperdebugger", "workspace");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}
