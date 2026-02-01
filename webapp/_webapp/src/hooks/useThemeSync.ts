import { useEffect } from "react";
import { useSettingStore } from "../stores/setting-store";

const THEME_ROOT_ID = "paper-debugger-root";

function getThemeRoot(): HTMLElement {
  return document.getElementById(THEME_ROOT_ID) ?? document.documentElement;
}

function applyThemeToElement(el: HTMLElement, isDark: boolean): void {
  if (isDark) {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

/**
 * Apply theme to all elements that may contain our UI.
 * In Overleaf embed mode, the sidebar is rendered via portal into #pd-embed-sidebar
 * (inside .ide-redesign-body), which is outside #paper-debugger-root. So we must
 * also set the theme on documentElement so that portal content gets dark mode.
 */
function applyTheme(root: HTMLElement, isDark: boolean): void {
  applyThemeToElement(root, isDark);
  if (root.id === THEME_ROOT_ID && root !== document.documentElement) {
    applyThemeToElement(document.documentElement, isDark);
  }
}

export function useThemeSync(): void {
  const themeMode = useSettingStore((s) => s.themeMode);

  useEffect(() => {
    const root = getThemeRoot();

    if (themeMode === "light") {
      applyTheme(root, false);
      return;
    }
    if (themeMode === "dark") {
      applyTheme(root, true);
      return;
    }

    // themeMode === "auto": follow system
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(root, media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [themeMode]);
}
