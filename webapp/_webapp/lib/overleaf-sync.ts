import { unzipSync, strFromU8 } from "fflate";

// Text file types worth sending as context. Binary assets (images, PDFs) are
// skipped — the AI reads source, and it keeps the payload small.
const TEXT_EXT = new Set([
  "tex",
  "bib",
  "sty",
  "cls",
  "bst",
  "txt",
  "md",
  "tikz",
  "def",
  "cfg",
  "bbl",
  "json",
  "yml",
  "yaml",
]);
const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 5_000_000;
const JOIN_TIMEOUT_MS = 15_000;

// Caps for the manual full-project sync (zip). Generous — the point is to mirror
// everything (incl. images) to the workspace so the CLI can compile — but still
// bounded so a pathological project can't blow up memory / native messaging.
const ZIP_MAX_FILE_BYTES = 25_000_000;
const ZIP_MAX_TOTAL_BYTES = 150_000_000;

export type ProjectFile = { path: string; content: string; encoding?: "utf8" | "base64" };

// An entity in the project tree, with the id needed to fetch its content.
type Entry = { path: string; id: string; kind: "doc" | "file" };

// Overleaf's rootFolder is a nested tree; docs are editable text, fileRefs are
// uploads (images, PDFs, occasionally .bib). Flatten to path+id+kind. Root
// folder's own name is not part of project paths. Exported for the self-check.
export function flattenTree(rootFolder: any): Entry[] {
  const out: Entry[] = [];
  const walk = (folder: any, prefix: string) => {
    for (const d of folder?.docs ?? []) out.push({ path: prefix + d.name, id: d._id, kind: "doc" });
    for (const f of folder?.fileRefs ?? []) out.push({ path: prefix + f.name, id: f._id, kind: "file" });
    for (const sub of folder?.folders ?? []) walk(sub, `${prefix}${sub.name}/`);
  };
  const roots = Array.isArray(rootFolder) ? rootFolder : [rootFolder];
  for (const r of roots) walk(r, "");
  return out;
}

// Get the project file tree (with entity ids) by piggybacking on the page's
// already-loaded socket.io client (window.io). The realtime server auto-joins
// from the projectId query param and pushes joinProjectResponse — same handshake
// the editor itself uses (see Overleaf RealTimeClient.js). One-shot: connect,
// read tree, disconnect.
function getProjectTree(projectId: string): Promise<Entry[]> {
  const io = (window as any).io;
  if (typeof io?.connect !== "function") {
    return Promise.reject(new Error("Overleaf socket.io (window.io) not available"));
  }
  return new Promise((resolve, reject) => {
    const socket = io.connect(window.origin, {
      "force new connection": true,
      reconnect: false,
      query: `projectId=${projectId}`,
    });
    const done = (fn: () => void) => {
      clearTimeout(timer);
      try {
        socket.disconnect();
      } catch {
        // ignore
      }
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new Error("joinProjectResponse timed out"))),
      JOIN_TIMEOUT_MS,
    );
    socket.on("joinProjectResponse", (resp: any) => {
      done(() => resolve(flattenTree(resp?.project?.rootFolder ?? [])));
    });
    console.log(`[PD sync] socket joining project ${projectId}…`);
    socket.on("connectionRejected", (err: any) => {
      done(() => reject(new Error(`connectionRejected: ${err?.message ?? "unknown"}`)));
    });
  });
}

// Fetch a single entity's text content over the same-origin authenticated HTTP
// endpoints. docs → plaintext dump; fileRefs → raw upload.
async function fetchEntity(projectId: string, e: Entry): Promise<ProjectFile | null> {
  const url =
    e.kind === "doc"
      ? `/project/${projectId}/doc/${e.id}/download`
      : `/project/${projectId}/file/${e.id}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;
  const content = await res.text();
  if (content.length > MAX_FILE_BYTES) return null;
  return { path: e.path, content };
}

// Fetch the tree's text files over per-file HTTP. Never the images/PDFs that
// dominate a large project's bytes — those are filtered out here.
async function fetchTextFiles(projectId: string, tree: Entry[], t0: number): Promise<ProjectFile[]> {
  const entries = tree.filter((e) =>
    TEXT_EXT.has(e.path.split(".").pop()?.toLowerCase() ?? ""),
  );
  console.log(
    `[PD sync] ${tree.length} entities, fetching ${entries.length} text files, ` +
      `skipping ${tree.length - entries.length} binaries`,
  );
  const fetched = await Promise.all(entries.map((e) => fetchEntity(projectId, e).catch(() => null)));

  const files: ProjectFile[] = [];
  let total = 0;
  for (const f of fetched) {
    if (!f) continue;
    total += f.content.length;
    if (total > MAX_TOTAL_BYTES) break;
    files.push(f);
  }
  console.log(
    `[PD sync] fetched ${files.length}/${entries.length} files, ${Math.round(total / 1024)}KB in ` +
      `${Math.round(performance.now() - t0)}ms`,
    files.map((f) => f.path),
  );
  return files;
}

// Chunked base64 — String.fromCharCode(...bytes) overflows the call stack on
// large arrays, so encode in windows.
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Downloaded byte count and total (total = null when the server doesn't send a
// content-length, i.e. a chunked/streamed zip → indeterminate).
export type DownloadProgress = { received: number; total: number | null };

// Read the response body incrementally so the caller can show download progress.
async function readWithProgress(res: Response, onProgress?: (p: DownloadProgress) => void): Promise<Uint8Array> {
  const total = Number(res.headers.get("content-length")) || null;
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({ received, total });
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// Split files into batches capped by cumulative content bytes, so each native
// message stays well under the pipe's frame limit. A single oversized file still
// gets its own (over-cap) batch — better to try than to silently drop it.
export function batchByBytes(files: ProjectFile[], capBytes: number): ProjectFile[][] {
  const batches: ProjectFile[][] = [];
  let cur: ProjectFile[] = [];
  let curBytes = 0;
  for (const f of files) {
    if (cur.length && curBytes + f.content.length > capBytes) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(f);
    curBytes += f.content.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// Manual full sync: download the whole project as a zip, unzip in-page, and
// return EVERY file — text as utf8, binaries (images/PDF) base64-encoded — so the
// host mirrors a complete, compilable project into the workspace. Independent of
// the socket/change-gate path; the reliable "sync everything now" fallback.
export async function fetchProjectZip(
  projectId: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<ProjectFile[]> {
  const t0 = performance.now();
  const res = await fetch(`/project/${projectId}/download/zip`, { credentials: "include" });
  if (!res.ok) throw new Error(`Overleaf download/zip failed: ${res.status}`);
  const entries = unzipSync(await readWithProgress(res, onProgress));

  const files: ProjectFile[] = [];
  let total = 0;
  let skipped = 0;
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) continue; // directory entry
    if (data.length > ZIP_MAX_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    if (total + data.length > ZIP_MAX_TOTAL_BYTES) {
      skipped += 1;
      continue;
    }
    total += data.length;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (TEXT_EXT.has(ext)) files.push({ path: name, content: strFromU8(data) });
    else files.push({ path: name, content: toBase64(data), encoding: "base64" });
  }
  console.log(
    `[PD sync] zip: ${files.length} files, ${Math.round(total / 1024)}KB` +
      (skipped ? `, skipped ${skipped} over cap` : "") +
      ` in ${Math.round(performance.now() - t0)}ms`,
  );
  // A manual full sync is authoritative: invalidate the change-gate cache so the
  // next auto-sync doesn't serve a stale text-only set.
  const w = watches.get(projectId);
  if (w) {
    w.files = null;
    w.dirty = true;
  }
  return files;
}

// Realtime events that mean the project changed. "recive" typos are Overleaf's
// own, not ours. Structural ones invalidate the tree; otUpdateApplied is a
// content-only edit.
const STRUCTURE_EVENTS = [
  "reciveNewDoc",
  "reciveNewFile",
  "reciveNewFolder",
  "removeEntity",
  "reciveEntityRename",
  "reciveEntityMove",
];

// One persistent socket per project, kept joined only to receive change events.
// While no change has arrived since the last sync, fetchProjectFiles returns the
// cached file set and hits Overleaf zero times.
type Watch = {
  socket: any;
  dirty: boolean; // content changed since last successful fetch
  treeStale: boolean; // structure changed; cached tree invalid
  tree: Entry[] | null;
  files: ProjectFile[] | null;
  ready: Promise<void>;
};
const watches = new Map<string, Watch>();

function ensureWatch(projectId: string): Watch {
  // Only the current project matters; drop sockets for any others (SPA nav).
  for (const [pid, w] of watches) {
    if (pid !== projectId) {
      try {
        w.socket.disconnect();
      } catch {
        // ignore
      }
      watches.delete(pid);
    }
  }
  const existing = watches.get(projectId);
  if (existing) return existing;

  const io = (window as any).io;
  if (typeof io?.connect !== "function") {
    throw new Error("Overleaf socket.io (window.io) not available");
  }
  const socket = io.connect(window.origin, {
    "force new connection": true,
    reconnect: false,
    query: `projectId=${projectId}`,
  });
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));
  const w: Watch = { socket, dirty: true, treeStale: false, tree: null, files: null, ready };
  watches.set(projectId, w);

  socket.on("joinProjectResponse", (resp: any) => {
    w.tree = flattenTree(resp?.project?.rootFolder ?? []);
    resolveReady();
  });
  socket.on("otUpdateApplied", () => {
    w.dirty = true;
  });
  for (const ev of STRUCTURE_EVENTS) {
    socket.on(ev, () => {
      w.dirty = true;
      w.treeStale = true;
    });
  }
  // On any disconnect we may have missed events — drop the watch so the next
  // fetch reopens and does a full resync.
  const drop = () => {
    watches.delete(projectId);
    resolveReady();
    console.log(`[PD sync] watch socket closed for ${projectId}`);
  };
  socket.on("disconnect", drop);
  socket.on("connectionRejected", drop);
  console.log(`[PD sync] watching project ${projectId} for changes`);
  return w;
}

// Sync the project's text files. Change-gated: an idle persistent socket tells
// us whether anything changed; if not, we return the cached set without touching
// Overleaf. On a real change we refresh the tree (only if structure changed) and
// re-pull text.
export async function fetchProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const t0 = performance.now();
  const w = ensureWatch(projectId);
  await Promise.race([w.ready, new Promise((r) => setTimeout(r, JOIN_TIMEOUT_MS))]);

  if (!w.dirty && w.files) {
    console.log(`[PD sync] unchanged — reusing ${w.files.length} cached files (0 requests)`);
    return w.files;
  }

  if (!w.tree || w.treeStale) {
    w.tree = await getProjectTree(projectId);
    w.treeStale = false;
  }
  const files = await fetchTextFiles(projectId, w.tree, t0);
  // Only commit dirty=false if the watch is still live (not dropped mid-fetch).
  if (watches.get(projectId) === w) {
    w.files = files;
    w.dirty = false;
  }
  return files;
}
