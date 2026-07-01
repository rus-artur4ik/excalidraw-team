import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useState } from "react";

import { unarchiveBoard } from "../data/boards";

import { useAppT } from "./useAppT";

export const ArchivedBoardBanner = ({
  roomId,
  onRestored,
}: {
  roomId: string;
  onRestored: () => void;
}) => {
  const t = useAppT();
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    setBusy(true);
    try {
      await unarchiveBoard(roomId);
      onRestored();
    } catch (error) {
      console.error(error);
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0.5rem 0.5rem 1rem",
        borderRadius: "var(--border-radius-lg)",
        background: "var(--island-bg-color)",
        border: "1px solid var(--default-border-color)",
        boxShadow: "var(--shadow-island)",
        fontSize: "0.8125rem",
        color: "var(--color-on-surface)",
      }}
    >
      <span>{t("app.editor.archivedBanner")}</span>
      <FilledButton
        variant="outlined"
        label={t("app.editor.restore")}
        status={busy ? "loading" : undefined}
        onClick={restore}
      />
    </div>
  );
};
