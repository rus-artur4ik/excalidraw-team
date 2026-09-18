import {
  defaultLang,
  languages,
  setLanguage,
} from "@excalidraw/excalidraw/i18n";
import { useEffect, useState } from "react";

import { useSetAtom } from "../app-jotai";
import { useAppLangCode } from "../app-language/language-state";

import { appLangReadyAtom } from "./useAppT";

/** Loads the app language; true once `t()` returns its strings. */
export const useAppLanguageReady = () => {
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

  return langReady;
};
