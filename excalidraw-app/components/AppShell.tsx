import {
  defaultLang,
  languages,
  setLanguage,
} from "@excalidraw/excalidraw/i18n";
import Spinner from "@excalidraw/excalidraw/components/Spinner";
import clsx from "clsx";
import { useEffect, useState } from "react";

import "../pages/pages.scss";

import { useSetAtom } from "../app-jotai";
import { useAppLangCode } from "../app-language/language-state";

import { useResolvedTheme } from "./useResolvedTheme";
import { appLangReadyAtom } from "./useAppT";

import type { ReactNode } from "react";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const theme = useResolvedTheme();
  const [langCode] = useAppLangCode();
  const [langReady, setLangReady] = useState(false);
  const bumpLangReady = useSetAtom(appLangReadyAtom);

  useEffect(() => {
    let active = true;
    const lang =
      languages.find((item) => item.code === langCode) ?? defaultLang;
    setLanguage(lang).finally(() => {
      if (active) {
        setLangReady(true);
        bumpLangReady((value) => value + 1);
      }
    });
    return () => {
      active = false;
    };
  }, [langCode, bumpLangReady]);

  return (
    <div
      className={clsx("excalidraw", "excalidraw--app-page", {
        "theme--dark": theme === "dark",
      })}
    >
      {langReady ? (
        children
      ) : (
        <div className="exa-page exa-shell-loading">
          <Spinner size={28} />
        </div>
      )}
    </div>
  );
};
