import fs from "node:fs";
import path from "node:path";
import { workspaceDir } from "./workspace.js";

export type SyncFile = { path: string; content: string; encoding?: "utf8" | "base64" };

// All files currently on disk under root, as forward-slash relative paths.
function listFilesRel(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else out.push(r);
    }
  };
  walk(root, "");
  return out;
}

// Write the incoming files into the per-project workspace (incremental by content
// compare — first sync writes everything). If `prune` is given, it's the complete
// set of paths that should exist; anything else in the workspace is deleted. When
// `prune` is absent the call is write-only — used for mid-batch full-sync messages
// and the text-only auto-sync (which must not delete binaries or sibling batches'
// files). Returns counts for logging.
export function syncProjectFiles(
  projectId: string | undefined,
  files: SyncFile[],
  prune?: string[] | null,
): { written: number; deleted: number } {
  const root = workspaceDir(projectId);
  let written = 0;

  for (const f of files) {
    if (typeof f?.path !== "string" || typeof f?.content !== "string") continue;
    const abs = path.resolve(root, f.path);
    // Reject anything that escapes the workspace root.
    if (abs !== root && !abs.startsWith(root + path.sep)) continue;

    const data = Buffer.from(f.content, f.encoding === "base64" ? "base64" : "utf8");
    let existing: Buffer | null = null;
    try {
      existing = fs.readFileSync(abs);
    } catch {
      // new file
    }
    if (!existing || !existing.equals(data)) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, data);
      written += 1;
    }
  }

  let deleted = 0;
  if (prune) {
    const keep = new Set(prune);
    for (const rel of listFilesRel(root)) {
      if (!keep.has(rel)) {
        try {
          fs.rmSync(path.join(root, rel));
          deleted += 1;
        } catch {
          // ignore
        }
      }
    }
  }
  return { written, deleted };
}
