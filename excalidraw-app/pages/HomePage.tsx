import {
  ExcalLogo,
  LoadIcon,
  PlusIcon,
} from "@excalidraw/excalidraw/components/icons";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppConfirm } from "../components/AppConfirm";
import { AppHeader } from "../components/AppHeader";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../router";
import {
  canWriteBoard,
  listInvitedBoards,
  listMyBoards,
  listTeamBoards,
  loadBoardKeys,
  loadTeam,
  teamRoleOf,
} from "../data/boards";
import {
  applyMove,
  createFolder,
  deleteFolder,
  folderIdOfBoard,
  listMyFolders,
  moveBoardToFolder,
  renameFolder,
  sortFolders,
} from "../data/folders";

import { BoardCard } from "./BoardCard";
import {
  BoardFilter,
  boardMatchesFilter,
  DEFAULT_BOARD_FILTER,
} from "./BoardFilter";
import { BoardSettingsDialog } from "./BoardSettings";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { FolderDialog } from "./FolderDialog";
import { FolderGrid, FolderHeader } from "./FolderGrid";

import type { BoardFilterValue } from "./BoardFilter";
import type { Board, Team } from "../data/boards";
import type { Folder } from "../data/folders";

const SkeletonCard = () => (
  <li className="exa-card" aria-hidden="true">
    <div className="exa-card__thumb">
      <div className="exa-skeleton" />
    </div>
    <div className="exa-card__body">
      <span className="exa-skeleton-pill" style={{ width: "60%" }} />
      <span className="exa-skeleton-pill" style={{ width: "40%" }} />
    </div>
  </li>
);

const unionById = (...groups: Board[][]): Board[] => {
  const byId = new Map<string, Board>();
  for (const group of groups) {
    for (const board of group) {
      byId.set(board.roomId, board);
    }
  }
  return [...byId.values()];
};

type FolderDialogState =
  | { mode: "create"; moveBoardId: string | null }
  | { mode: "rename"; folder: Folder };

export const HomePage = ({
  folderId,
}: {
  /** The folder opened at `/f/:id`; null shows the folders and loose boards. */
  folderId: string | null;
}) => {
  const t = useAppT();
  const { user, loading, signIn } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [roomKeys, setRoomKeys] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingsBoard, setSettingsBoard] = useState<Board | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [team, setTeam] = useState<Team | null>(null);
  const [filter, setFilter] = useState<BoardFilterValue>(DEFAULT_BOARD_FILTER);

  const [folders, setFoldersState] = useState<Folder[]>([]);
  // Mirror of `folders` for async handlers that must see the latest list
  // without waiting for a re-render (optimistic moves, create-then-move).
  const foldersRef = useRef<Folder[]>([]);
  const setFolders = useCallback((next: Folder[]) => {
    foldersRef.current = next;
    setFoldersState(next);
  }, []);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(
    null,
  );
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Board previews for this visit of the home page: switching folders
  // remounts the cards, and should not refetch every preview.
  const [thumbnails] = useState(() => new Map<string, string | null>());

  useEffect(() => {
    if (!user) {
      setBoards([]);
      setFolders([]);
      setIsAdmin(false);
      setIsTeamMember(false);
      setLoadingBoards(false);
      return;
    }
    let cancelled = false;
    setLoadingBoards(true);
    setLoadError(false);
    (async () => {
      const loadedTeam = await loadTeam();
      const role = teamRoleOf(loadedTeam, user.email);
      const [mine, invited, teamBoards, loadedFolders] = await Promise.all([
        listMyBoards(),
        user.email ? listInvitedBoards(user.email) : Promise.resolve([]),
        role ? listTeamBoards() : Promise.resolve([]),
        listMyFolders(user.uid),
      ]);
      if (cancelled) {
        return;
      }
      const list = unionById(mine, invited, teamBoards);
      setBoards(list);
      setFolders(loadedFolders);
      setTeam(loadedTeam);
      setIsAdmin(role === "admin");
      setIsTeamMember(!!role);
      const keys = await loadBoardKeys(list.map((board) => board.roomId));
      if (!cancelled) {
        setRoomKeys(keys);
      }
    })()
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBoards(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey, setFolders]);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );
  const openFolder = folderId ? folderById.get(folderId) ?? null : null;
  const folderMissing =
    !!folderId && !loadingBoards && !loadError && !openFolder;

  // A deleted folder, or a link to someone else's (folders are private),
  // lands on the root instead of an empty page.
  useEffect(() => {
    if (folderMissing) {
      navigate("/", { replace: true });
    }
  }, [folderMissing]);

  const moveBoard = useCallback(
    async (boardId: string, targetFolderId: string | null) => {
      setFolderError(null);
      const previous = foldersRef.current;
      setFolders(applyMove(previous, boardId, targetFolderId));
      try {
        await moveBoardToFolder(boardId, targetFolderId, previous);
      } catch (error) {
        console.error(error);
        setFolders(previous);
        setFolderError(t("app.folders.moveError"));
      }
    },
    [setFolders, t],
  );

  const submitFolderDialog = async (name: string) => {
    if (!folderDialog) {
      return;
    }
    if (folderDialog.mode === "rename") {
      await renameFolder(folderDialog.folder.id, name);
      setFolders(
        sortFolders(
          foldersRef.current.map((folder) =>
            folder.id === folderDialog.folder.id ? { ...folder, name } : folder,
          ),
        ),
      );
      setFolderDialog(null);
      return;
    }
    const created = await createFolder(name);
    setFolders(sortFolders([...foldersRef.current, created]));
    setFolderDialog(null);
    if (folderDialog.moveBoardId) {
      void moveBoard(folderDialog.moveBoardId, created.id);
    }
  };

  const removeFolder = async () => {
    const folder = deletingFolder;
    if (!folder) {
      return;
    }
    setDeletingFolder(null);
    setFolderError(null);
    try {
      await deleteFolder(folder.id);
      setFolders(foldersRef.current.filter((item) => item.id !== folder.id));
      if (folder.id === folderId) {
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error(error);
      setFolderError(t("app.folders.deleteError"));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="exa-page">
          <p className="exa-loading-text">{t("app.common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="exa-signin">
          <div className="exa-signin__logo">{ExcalLogo}</div>
          <h1 className="exa-signin__title">{t("app.brand")}</h1>
          <p className="exa-signin__tagline">{t("app.signIn.tagline")}</p>
          <div className="exa-signin__card">
            <FilledButton
              size="large"
              fullWidth
              label={t("app.signIn.google")}
              onClick={async () => {
                try {
                  await signIn();
                } catch (error) {
                  console.error(error);
                }
              }}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  const canManage = (board: Board): boolean =>
    board.ownerUid === user.uid ||
    (isAdmin && (board.visibility === "team" || !!board.teamId));

  const viewFolderId = openFolder?.id ?? null;
  const folderCounts = new Map<string, number>();
  // Boards of the open folder (the unfiled ones at the root) before the
  // filter, so the empty message can tell "filtered out" from "empty".
  let inViewTotal = 0;
  const visibleBoards: Board[] = [];
  for (const board of boards) {
    const boardFolderId = folderIdOfBoard(folders, board.roomId);
    const matches = boardMatchesFilter(
      board,
      filter,
      canWriteBoard(board, user, team),
    );
    if (matches && boardFolderId !== null) {
      folderCounts.set(
        boardFolderId,
        (folderCounts.get(boardFolderId) ?? 0) + 1,
      );
    }
    if (boardFolderId === viewFolderId) {
      inViewTotal += 1;
      if (matches) {
        visibleBoards.push(board);
      }
    }
  }

  const emptyMessage =
    inViewTotal > 0
      ? t("app.home.emptyFiltered")
      : openFolder
      ? t("app.folders.empty")
      : boards.length > 0
      ? t("app.folders.emptyUnfiled")
      : t("app.home.empty");

  return (
    <AppShell>
      <AppHeader user={user} isAdmin={isAdmin} />

      <div className="exa-page">
        <div className="exa-page-head">
          <h1>{t("app.home.title")}</h1>
          <div className="exa-page-head__actions">
            <BoardFilter value={filter} onChange={setFilter} />
            {!folderId && (
              <FilledButton
                size="large"
                variant="outlined"
                icon={LoadIcon}
                label={t("app.folders.newFolder")}
                onClick={() =>
                  setFolderDialog({ mode: "create", moveBoardId: null })
                }
              />
            )}
            <FilledButton
              size="large"
              icon={PlusIcon}
              label={t("app.home.newBoard")}
              onClick={() => setCreating(true)}
            />
          </div>
        </div>

        {folderError && (
          <p className="exa-error-text" role="alert">
            {folderError}
          </p>
        )}

        {loadingBoards ? (
          <ul className="exa-grid">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonCard key={index} />
            ))}
          </ul>
        ) : loadError ? (
          <div className="exa-error" role="alert">
            <span>{t("app.home.loadError")}</span>
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("app.common.retry")}
              onClick={() => setReloadKey((key) => key + 1)}
            />
          </div>
        ) : (
          // Keyed by folder so the entrance animations replay on every switch.
          <div key={viewFolderId ?? ""} className="exa-home-view">
            {openFolder ? (
              <FolderHeader
                folder={openFolder}
                count={folderCounts.get(openFolder.id) ?? 0}
                dragging={dragging}
                onDropBoard={(boardId) => void moveBoard(boardId, null)}
                onRename={() =>
                  setFolderDialog({ mode: "rename", folder: openFolder })
                }
                onDelete={() => setDeletingFolder(openFolder)}
              />
            ) : (
              folders.length > 0 && (
                <>
                  <h2 className="exa-home-section">
                    {t("app.folders.foldersHeading")}
                  </h2>
                  <FolderGrid
                    folders={folders}
                    counts={folderCounts}
                    dragging={dragging}
                    onDropBoard={(boardId, target) =>
                      void moveBoard(boardId, target)
                    }
                    onRename={(folder) =>
                      setFolderDialog({ mode: "rename", folder })
                    }
                    onDelete={setDeletingFolder}
                  />
                  <h2 className="exa-home-section">
                    {t("app.folders.boardsHeading")}
                  </h2>
                </>
              )
            )}
            {visibleBoards.length === 0 ? (
              <p className="exa-empty">{emptyMessage}</p>
            ) : (
              <ul className="exa-grid exa-grid--enter">
                {visibleBoards.map((board) => (
                  <BoardCard
                    key={board.roomId}
                    board={board}
                    canManage={canManage(board)}
                    roomKey={roomKeys.get(board.roomId) ?? null}
                    thumbnails={thumbnails}
                    onSettings={() => setSettingsBoard(board)}
                    folders={folders}
                    folderId={viewFolderId}
                    onMoveToFolder={(target) =>
                      void moveBoard(board.roomId, target)
                    }
                    onNewFolder={() =>
                      setFolderDialog({
                        mode: "create",
                        moveBoardId: board.roomId,
                      })
                    }
                    onDragStateChange={setDragging}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {creating && (
        <CreateBoardDialog
          allowTeam={isTeamMember}
          folder={
            openFolder
              ? { id: openFolder.id, folders: foldersRef.current }
              : null
          }
          onClose={() => setCreating(false)}
        />
      )}

      {settingsBoard && (
        <BoardSettingsDialog
          board={settingsBoard}
          onClose={() => setSettingsBoard(null)}
          onSaved={() => {
            setSettingsBoard(null);
            setReloadKey((key) => key + 1);
          }}
          onDeleted={() => {
            setSettingsBoard(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {folderDialog && (
        <FolderDialog
          mode={folderDialog.mode}
          initialName={
            folderDialog.mode === "rename" ? folderDialog.folder.name : ""
          }
          onSubmit={submitFolderDialog}
          onClose={() => setFolderDialog(null)}
        />
      )}

      {deletingFolder && (
        <AppConfirm
          title={t("app.folders.deleteTitle")}
          message={t("app.folders.deleteMessage", {
            name: deletingFolder.name || t("app.folders.untitled"),
          })}
          confirmLabel={t("app.folders.delete")}
          danger
          onConfirm={removeFolder}
          onClose={() => setDeletingFolder(null)}
        />
      )}
    </AppShell>
  );
};
