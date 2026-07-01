import { THEME } from "@excalidraw/excalidraw";
import { useEffect, useState } from "react";

import { STORAGE_KEYS } from "../app_constants";

type ThemePref = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_CHANGE_EVENT = "excalidraw-app-theme-change";

const darkMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

export const getStoredThemePref = (): ThemePref => {
  const pref = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME);
  return pref === THEME.DARK || pref === THEME.LIGHT ? pref : "system";
};

const resolve = (): ResolvedTheme => {
  const pref = getStoredThemePref();
  if (pref === "system") {
    return darkMediaQuery()?.matches ? "dark" : "light";
  }
  return pref;
};

export const setStoredThemePref = (pref: ThemePref) => {
  localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, pref);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

export const useResolvedTheme = (): ResolvedTheme => {
  const [theme, setTheme] = useState<ResolvedTheme>(resolve);

  useEffect(() => {
    const update = () => setTheme(resolve());
    const media = darkMediaQuery();
    media?.addEventListener("change", update);
    window.addEventListener("storage", update);
    window.addEventListener(THEME_CHANGE_EVENT, update);
    return () => {
      media?.removeEventListener("change", update);
      window.removeEventListener("storage", update);
      window.removeEventListener(THEME_CHANGE_EVENT, update);
    };
  }, []);

  return theme;
};
