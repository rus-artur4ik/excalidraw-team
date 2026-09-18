import Spinner from "@excalidraw/excalidraw/components/Spinner";
import clsx from "clsx";

import "../pages/pages.scss";

import { useAppLanguageReady } from "./useAppLanguageReady";
import { useResolvedTheme } from "./useResolvedTheme";

import type { ReactNode } from "react";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const theme = useResolvedTheme();
  const langReady = useAppLanguageReady();

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
