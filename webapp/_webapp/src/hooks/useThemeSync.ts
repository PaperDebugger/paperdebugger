import { useEffect } from "react";
import { useSettingStore, type ThemeMode } from "../stores/setting-store";

const THEME_ROOT_ID = "paper-debugger-root";

function getThemeRoot(): HTMLElement {
  return document.getElementById(THEME_ROOT_ID) ?? document.documentElement;
}

function applyTheme(root: HTMLElement, isDark: boolean): void {
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
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
