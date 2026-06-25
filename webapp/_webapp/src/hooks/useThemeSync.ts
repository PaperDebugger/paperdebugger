import { useEffect } from "react";
import { useSettingStore } from "../stores/setting-store";

// Every container that carries .pd-scope; the .dark class must sit on these so
// scoped heroui rules (.pd-scope.dark ...) resolve. Falls back to <html> on
// standalone pages (settings/popup) where no scope root exists.
const SCOPE_ROOT_IDS = ["paper-debugger-root", "pd-portal", "pd-embed-sidebar"];

function applyThemeToElement(el: HTMLElement, isDark: boolean): void {
  if (isDark) {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

function applyTheme(isDark: boolean): void {
  const roots = SCOPE_ROOT_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  if (roots.length === 0) {
    applyThemeToElement(document.documentElement, isDark);
    return;
  }
  for (const root of roots) applyThemeToElement(root, isDark);
}

export function useThemeSync(): void {
  const themeMode = useSettingStore((s) => s.themeMode);

  useEffect(() => {
    if (themeMode === "light") {
      applyTheme(false);
      return;
    }
    if (themeMode === "dark") {
      applyTheme(true);
      return;
    }

    // themeMode === "auto": follow system
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [themeMode]);
}
