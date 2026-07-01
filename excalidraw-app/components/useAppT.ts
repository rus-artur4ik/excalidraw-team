import { t } from "@excalidraw/excalidraw/i18n";

import { atom, useAtomValue } from "../app-jotai";

export const appLangReadyAtom = atom(0);

export const useAppT = () => {
  useAtomValue(appLangReadyAtom);
  return t;
};
