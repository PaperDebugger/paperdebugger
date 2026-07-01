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

export type ProjectFile = { path: string; content: string };

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

// Fetch the project's text files only — never the images/PDFs that dominate a
// large project's bytes. Tree via socket, contents via per-file HTTP in
// parallel. Host diffs against disk, so re-fetching unchanged text is cheap to
// write; the win here is skipping binaries entirely.
// ponytail: fetches all text every turn (no per-file version to diff on).
// Text is small; add an mtime/rev gate if a huge project makes this drag.
export async function fetchProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const t0 = performance.now();
  const tree = await getProjectTree(projectId);
  const entries = tree.filter((e) =>
    TEXT_EXT.has(e.path.split(".").pop()?.toLowerCase() ?? ""),
  );
  console.log(
    `[PD sync] tree: ${tree.length} entities, ${entries.length} text files to fetch, ` +
      `skipping ${tree.length - entries.length} binaries (${Math.round(performance.now() - t0)}ms)`,
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
    `[PD sync] fetched ${files.length}/${entries.length} files, ${Math.round(total / 1024)}KB total ` +
      `in ${Math.round(performance.now() - t0)}ms`,
    files.map((f) => f.path),
  );
  return files;
}
