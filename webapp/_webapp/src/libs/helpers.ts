import { EditorView } from "@codemirror/view";

export async function onElementAppeared(selector: string, callback: (element: Element) => void) {
  const element = document.querySelector(selector);
  if (element) {
    return callback(element);
  }

  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (element) {
      observer.disconnect();
      callback(element);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export function onElementAdded(selector: string, callback: (element: Element) => void) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && (node as Element).matches(selector)) {
          callback(node as Element);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

export function getCodeMirrorView(): EditorView | null {
  const cmContent = document.querySelector(".cm-content");
  const view = (cmContent as any)?.cmView?.view as EditorView; // eslint-disable-line @typescript-eslint/no-explicit-any
  return view;
}

export function applyChanges(changes: string, range: Range): boolean {
  const newText = document.createTextNode(changes);
  range.deleteContents();
  range.insertNode(newText);
  return true;
}

export function getProjectId() {
  if (import.meta.env.DEV) {
    return localStorage.getItem("pd.projectId") ?? "";
  }
  const match = window.location.pathname.match(/\/project\/([a-zA-Z0-9]+)/);
  return match ? match[1] : "";
}

export function getProjectZipUrl() {
  const projectId = getProjectId();
  const url = new URL(window.location.href);
  url.pathname = "/project/" + projectId + "/download/zip";
  url.search = "";
  url.hash = "";
  return url.toString();
}

// Generate ID functions
export function generateIdSeed() {
  const pid = Math.floor(Math.random() * 32767).toString(16);
  const machine = Math.floor(Math.random() * 16777216).toString(16);
  const timestamp = Math.floor(new Date().valueOf() / 1000).toString(16);
  return (
    "00000000".substr(0, 8 - timestamp.length) +
    timestamp +
    "000000".substr(0, 6 - machine.length) +
    machine +
    "0000".substr(0, 4 - pid.length) +
    pid
  );
}

export function generateId() {
  return generateIdSeed() + "000001";
}

// Convert a byte array to big-endian 32-bit words
function bytesToWords(bytes: Uint8Array): number[] {
  const words: number[] = [];
  for (let i = 0, b = 0; i < bytes.length; i++, b += 8) words[b >>> 5] |= bytes[i] << (24 - (b % 32));
  return words;
}

// Convert big-endian 32-bit words to a byte array
function wordsToBytes(words: number[]) {
  const bytes = [];
  for (let b = 0; b < words.length * 32; b += 8) bytes.push((words[b >>> 5] >>> (24 - (b % 32))) & 0xff);
  return bytes;
}

export function generateSHA1Hash(inputString: string): string {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(inputString);

  const m = bytesToWords(uint8Array);
  const l = uint8Array.length * 8;
  const w = [];
  let H0 = 1732584193;
  let H1 = -271733879;
  let H2 = -1732584194;
  let H3 = 271733878;
  let H4 = -1009589776;

  // Padding
  m[l >> 5] |= 0x80 << (24 - (l % 32));
  m[(((l + 64) >>> 9) << 4) + 15] = l;

  for (let i = 0; i < m.length; i += 16) {
    const a = H0;
    const b = H1;
    const c = H2;
    const d = H3;
    const e = H4;

    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = m[i + j];
      else {
        const n: number = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
        w[j] = (n << 1) | (n >>> 31);
      }

      const t =
        ((H0 << 5) | (H0 >>> 27)) +
        H4 +
        (w[j] >>> 0) +
        (j < 20
          ? ((H1 & H2) | (~H1 & H3)) + 1518500249
          : j < 40
            ? (H1 ^ H2 ^ H3) + 1859775393
            : j < 60
              ? ((H1 & H2) | (H1 & H3) | (H2 & H3)) - 1894007588
              : (H1 ^ H2 ^ H3) - 899497514);

      H4 = H3;
      H3 = H2;
      H2 = (H1 << 30) | (H1 >>> 2);
      H1 = H0;
      H0 = t;
    }

    H0 += a;
    H1 += b;
    H2 += c;
    H3 += d;
    H4 += e;
  }

  const result = wordsToBytes([H0, H1, H2, H3, H4]);

  // Convert array of bytes to a hex string
  // padStart is used to ensure numbers that are
  // less than 16 will still be converted into the two-character format
  // For example:
  // "5" => "05"
  // "a" => "0a"
  // "ff" => "ff"
  return result.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Overleaf Comments Clicked LocalStorage ---
const OVERLEAF_COMMENTS_CLICKED_PREFIX = "pd.overleaf_comments_clicked.";
const MAX_CLICKED_COMMENTS = 200;

export function getClickedOverleafComments(projectId: string): string[] {
  if (!projectId) return [];
  const key = OVERLEAF_COMMENTS_CLICKED_PREFIX + projectId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

export function addClickedOverleafComment(projectId: string, messageId: string) {
  if (!projectId || !messageId) return;
  const key = OVERLEAF_COMMENTS_CLICKED_PREFIX + projectId;
  let arr = getClickedOverleafComments(projectId);
  // 去重
  arr = arr.filter((id) => id !== messageId);
  arr.push(messageId);
  // 最多 200 条
  if (arr.length > MAX_CLICKED_COMMENTS) {
    arr = arr.slice(arr.length - MAX_CLICKED_COMMENTS);
  }
  localStorage.setItem(key, JSON.stringify(arr));
}

export function hasClickedOverleafComment(projectId: string, messageId: string): boolean {
  if (!projectId || !messageId) return false;
  const arr = getClickedOverleafComments(projectId);
  return arr.includes(messageId);
}

// 经典 debounce，适合事件回调
export function debounce(fn: (...args: unknown[]) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: unknown[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to base64 string."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob); // 读取为 DataURL 格式（包含 base64）
  });
}
