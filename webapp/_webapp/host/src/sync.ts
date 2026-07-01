import fs from "node:fs";
import path from "node:path";
import { workspaceDir } from "./workspace.js";

export type SyncFile = { path: string; content: string };

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

// Mirror the incoming file set into the per-project workspace: write new/changed
// files, delete files that are gone. Incremental by content compare — first sync
// (empty dir) writes everything. Returns counts for logging.
export function syncProjectFiles(
  projectId: string | undefined,
  files: SyncFile[],
): { written: number; deleted: number } {
  const root = workspaceDir(projectId);
  const wanted = new Set<string>();
  let written = 0;

  for (const f of files) {
    if (typeof f?.path !== "string" || typeof f?.content !== "string") continue;
    const abs = path.resolve(root, f.path);
    // Reject anything that escapes the workspace root.
    if (abs !== root && !abs.startsWith(root + path.sep)) continue;
    wanted.add(path.relative(root, abs).split(path.sep).join("/"));

    let existing: string | null = null;
    try {
      existing = fs.readFileSync(abs, "utf8");
    } catch {
      // new file
    }
    if (existing !== f.content) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.content, "utf8");
      written += 1;
    }
  }

  let deleted = 0;
  for (const rel of listFilesRel(root)) {
    if (!wanted.has(rel)) {
      try {
        fs.rmSync(path.join(root, rel));
        deleted += 1;
      } catch {
        // ignore
      }
    }
  }
  return { written, deleted };
}
