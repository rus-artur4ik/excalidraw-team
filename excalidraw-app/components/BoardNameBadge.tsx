import { useI18n } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../app-jotai";
import { currentBoardAtom } from "../boardSession";

export const BoardNameBadge = () => {
  const currentBoard = useAtomValue(currentBoardAtom);
  const { t } = useI18n();
  const title = currentBoard?.title?.trim();
  if (!title) {
    return null;
  }
  return (
    <div className="board-name-badge" title={t("app.editor.nameTooltip")}>
      {title}
    </div>
  );
};
