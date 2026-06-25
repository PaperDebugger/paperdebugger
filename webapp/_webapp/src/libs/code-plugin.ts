import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { BundledLanguage, ThemeInput } from "shiki";
import type { CodeHighlighterPlugin } from "streamdown";

import langBash from "@shikijs/langs/bash";
import langC from "@shikijs/langs/c";
import langCpp from "@shikijs/langs/cpp";
import langGo from "@shikijs/langs/go";
import langJava from "@shikijs/langs/java";
import langJs from "@shikijs/langs/javascript";
import langLatex from "@shikijs/langs/latex";
import langMatlab from "@shikijs/langs/matlab";
import langPython from "@shikijs/langs/python";
import langR from "@shikijs/langs/r";
import langRust from "@shikijs/langs/rust";
import langSql from "@shikijs/langs/sql";
import langTs from "@shikijs/langs/typescript";

import themeLight from "@shikijs/themes/github-light";
import themeDark from "@shikijs/themes/ayu-dark";

const LANGS = [langBash, langC, langCpp, langGo, langJava, langJs, langLatex, langMatlab, langPython, langR, langRust, langSql, langTs];
const SUPPORTED = new Set(["bash", "sh", "c", "cpp", "go", "java", "javascript", "js", "latex", "tex", "matlab", "python", "r", "rust", "sql", "typescript", "ts"]);

type Themes = [ThemeInput, ThemeInput];
type Callback = (tokens: unknown) => void;

const pending = new Map<string, Set<Callback>>();
const cache = new Map<string, unknown>();

const highlighterPromise = createHighlighterCore({
  themes: [themeLight, themeDark],
  langs: LANGS,
  engine: createJavaScriptRegexEngine({ forgiving: true }),
});

function cacheKey(code: string, lang: string, themes: Themes) {
  const prefix = code.slice(0, 100);
  const suffix = code.length > 100 ? code.slice(-100) : "";
  return `${lang}:${themes[0]}:${themes[1]}:${code.length}:${prefix}:${suffix}`;
}

function themeName(t: unknown): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && "name" in t) return (t as { name: string }).name;
  return "custom";
}

// ponytail: cast to satisfy cross-package ThemeInput conflicts; runtime shape matches CodeHighlighterPlugin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _code = {
  name: "shiki",
  type: "code-highlighter",
  supportsLanguage(lang: string) {
    return SUPPORTED.has(lang.trim().toLowerCase());
  },
  getSupportedLanguages() {
    return Array.from(SUPPORTED) as BundledLanguage[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getThemes(): any {
    return ["github-light", "ayu-dark"];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlight({ code: src, language, themes }: { code: string; language: string; themes: any }, cb?: Callback) {
    const lang = SUPPORTED.has(language.trim().toLowerCase()) ? language.trim().toLowerCase() : "text";
    const names: [string, string] = [themeName(themes[0]), themeName(themes[1])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = cacheKey(src, lang, names as any);

    if (cache.has(key)) return cache.get(key);

    if (cb) {
      if (!pending.has(key)) pending.set(key, new Set<Callback>());
      pending.get(key)!.add(cb);
    }

    highlighterPromise.then((h) => {
      const tokens = h.codeToTokens(src, {
        lang: h.getLoadedLanguages().includes(lang) ? lang : "text",
        themes: { light: names[0] as string, dark: names[1] as string },
      });
      cache.set(key, tokens);
      const waiters = pending.get(key);
      if (waiters) {
        for (const fn of waiters) fn(tokens);
        pending.delete(key);
      }
    }).catch((e) => {
      console.error("[code-plugin] highlight failed:", e);
      pending.delete(key);
    });

    return null;
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const code = _code as any as CodeHighlighterPlugin;
