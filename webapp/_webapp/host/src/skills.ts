import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SkillInfo = { name: string; description: string; source: string };

// Pull `name` and `description` out of a SKILL.md YAML frontmatter block without a
// full YAML parser — we only need two scalar fields. Handles same-line values and
// `|`/`>` block scalars (indented continuation lines).
function parseFrontmatter(raw: string): { name?: string; description?: string } {
  // Normalize CRLF — JS `.` doesn't match `\r` and `$` won't anchor before it,
  // so a CRLF SKILL.md would fail every line match otherwise.
  const md = raw.replace(/\r\n/g, "\n");
  if (!md.startsWith("---")) return {};
  const end = md.indexOf("\n---", 3);
  if (end < 0) return {};
  const lines = md.slice(3, end).split("\n");

  const strip = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  let name: string | undefined;
  let description: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const m = /^([a-zA-Z_]+):\s?(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, rest] = m;
    if (key === "name") name = strip(rest);
    else if (key === "description") {
      const inline = rest.trim();
      if (inline && inline !== "|" && inline !== ">" && inline !== "|-" && inline !== ">-") {
        description = strip(rest);
      } else {
        // Block scalar: gather following indented lines until the next top key.
        const buf: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === "") continue;
          if (!/^\s/.test(lines[j])) break; // dedented → next key
          buf.push(lines[j].trim());
        }
        description = buf.join(" ");
      }
    }
  }
  return { name, description };
}

// Scan one skills directory (entries may be symlinks — fs follows them on read).
function scanDir(dir: string, source: string): SkillInfo[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillInfo[] = [];
  for (const e of entries) {
    // e.isDirectory() is false for symlinks; try reading SKILL.md regardless.
    if (e.name.startsWith(".")) continue;
    let md: string;
    try {
      md = fs.readFileSync(path.join(dir, e.name, "SKILL.md"), "utf8");
    } catch {
      continue; // not a skill dir
    }
    const { name, description } = parseFrontmatter(md);
    out.push({ name: name || e.name, description: (description || "").slice(0, 300), source });
  }
  return out;
}

// Skills the given CLI would resolve, sorted by name. Claude and Codex both use
// the same SKILL.md frontmatter format, just different user stores.
// ponytail: user store only. Plugin skills (~/.claude/plugins) have a messier
// layout — add later if someone needs the namespaced ones.
export function listSkills(provider?: string): SkillInfo[] {
  const dir =
    provider === "codex"
      ? path.join(os.homedir(), ".codex", "skills")
      : path.join(os.homedir(), ".claude", "skills");
  const skills = scanDir(dir, provider === "codex" ? "codex" : "claude");
  return skills.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0));
}
