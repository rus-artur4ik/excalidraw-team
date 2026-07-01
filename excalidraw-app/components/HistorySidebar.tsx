import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import Spinner from "@excalidraw/excalidraw/components/Spinner";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtomValue } from "../app-jotai";
import { sharedSceneRoomAtom } from "../boardSession";
import { getBoardRouteId } from "../router";
import { LocalData } from "../data/LocalData";
import {
  createCollabRestoreElements,
  isSceneHistoryDeltaRecordable,
  resetTransientAppState,
  SceneHistory,
} from "../data/SceneHistory";
import {
  loadSceneHistoryEntryFromFirebase,
  loadSceneHistoryThumbnailFromFirebase,
  subscribeSceneHistoryFromFirebase,
} from "../data/firebase";
import { createHistoryThumbnail } from "../data/sceneHistoryThumbnail";
import { deriveChangeFocusFromDelta } from "../data/historyThumbnailFocus";

import { AppConfirm } from "./AppConfirm";

import "./HistorySidebar.scss";

import type { CollabAPI } from "../collab/Collab";
import type { SceneHistoryData, SceneHistoryEntry } from "../data/SceneHistory";

type HistorySidebarProps = {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
  isCollaborating: boolean;
};

type SceneHistoryProviderProps = {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  children: React.ReactNode;
};

type SceneHistoryContextValue = {
  historyData: SceneHistoryData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isSharedHistory: boolean;
  sessionId: string;
  markNextChangeAsRestore: (sourceEntryId: string) => void;
  loadThumbnail: (entryId: string) => Promise<string | null>;
  reconstructEntry: (entryId: string) => Promise<{
    entry: SceneHistoryEntry;
    elements: OrderedExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  } | null>;
};

type PreviewOrigin = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const SCENE_HISTORY_PREVIEW_LOCK = "scene-history-preview";
const HISTORY_ROW_HEIGHT = 84;
const HISTORY_OVERSCAN = 6;

const SceneHistoryContext = createContext<SceneHistoryContextValue | null>(
  null,
);

const createSessionId = () => {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
};

const getCurrentScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
): PreviewOrigin => ({
  elements:
    excalidrawAPI.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
  appState: excalidrawAPI.getAppState(),
  files: excalidrawAPI.getFiles(),
});

const addFilesToScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  files: BinaryFiles,
) => {
  const fileData = Object.values(files);

  if (fileData.length) {
    excalidrawAPI.addFiles(fileData);
  }
};

const formatEntryTime = (timestamp: number) => {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

type TFn = ReturnType<typeof useI18n>["t"];

const getEntryTitle = (entry: SceneHistoryEntry, t: TFn) => {
  if (entry.kind === "initial") {
    return t("app.history.initialVersion");
  }

  if (entry.kind === "restore") {
    return t("app.history.restoreKind");
  }

  return t("app.history.version", { n: entry.sequence });
};

const getAuthorInitials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /[\p{L}\p{N}]/u.test(part[0] ?? ""));

  if (!parts.length) {
    const stripped = name.replace(/[^\p{L}\p{N}]/gu, "");
    return stripped ? stripped.slice(0, 2).toUpperCase() : "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAuthorColor = (key: string) => {
  let hash = 0;

  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }

  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
};

const getEntryAuthorLabel = (
  entry: SceneHistoryEntry,
  currentSessionId: string,
  t: TFn,
) => {
  const isCurrentSession = entry.sessionId === currentSessionId;

  if (entry.author) {
    return isCurrentSession
      ? t("app.history.you", { author: entry.author })
      : entry.author;
  }

  return isCurrentSession
    ? t("app.history.thisSession")
    : t("app.history.previousSession");
};

const HistoryThumbnail = ({
  entry,
  cacheRef,
  loadThumbnail,
}: {
  entry: SceneHistoryEntry;
  cacheRef: { current: Map<string, string | null> };
  loadThumbnail: (entryId: string) => Promise<string | null>;
}) => {
  const [url, setUrl] = useState<string | null>(
    entry.thumbnail ?? cacheRef.current.get(entry.id) ?? null,
  );

  useEffect(() => {
    if (entry.thumbnail) {
      setUrl(entry.thumbnail);
      return;
    }
    if (cacheRef.current.has(entry.id)) {
      setUrl(cacheRef.current.get(entry.id) ?? null);
      return;
    }
    let active = true;
    void loadThumbnail(entry.id).then((result) => {
      cacheRef.current.set(entry.id, result);
      if (active) {
        setUrl(result);
      }
    });
    return () => {
      active = false;
    };
  }, [entry.id, entry.thumbnail, cacheRef, loadThumbnail]);

  if (url) {
    return <img alt="" src={url} loading="lazy" decoding="async" />;
  }

  if (entry.author) {
    return entry.author.startsWith("Бот ") ? (
      <span className="history-sidebar__avatar" title={entry.author}>
        🤖
      </span>
    ) : (
      <span
        className="history-sidebar__avatar"
        style={{ backgroundColor: getAuthorColor(entry.author) }}
        title={entry.author}
      >
        {getAuthorInitials(entry.author)}
      </span>
    );
  }

  return <span>{entry.kind === "initial" ? "" : entry.sequence}</span>;
};

const useSceneHistoryContext = () => {
  const context = useContext(SceneHistoryContext);

  if (!context) {
    throw new Error("SceneHistoryProvider is missing");
  }

  return context;
};

export const SceneHistoryProvider = ({
  collabAPI,
  excalidrawAPI,
  children,
}: SceneHistoryProviderProps) => {
  const { t } = useI18n();
  const sessionIdRef = useRef(createSessionId());
  const recordQueueRef = useRef(Promise.resolve());
  const isMountedRef = useRef(false);
  const pendingRestoreRef = useRef<{ sourceEntryId: string } | null>(null);
  const [historyData, setHistoryData] = useState<SceneHistoryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isBoardRoute = useMemo(
    () => !!getBoardRouteId(window.location.pathname),
    [],
  );
  const sharedRoom = useAtomValue(sharedSceneRoomAtom);
  const collabRoomId = sharedRoom?.roomId ?? null;
  const collabRoomKey = sharedRoom?.roomKey ?? null;
  const isSharedHistory = isBoardRoute || !!sharedRoom;
  const historySessionId =
    isSharedHistory && collabAPI
      ? collabAPI.getSceneHistorySessionId()
      : sessionIdRef.current;

  const setHistoryState = useCallback((nextHistoryData: SceneHistoryData) => {
    setHistoryData(nextHistoryData);
  }, []);

  const markNextChangeAsRestore = useCallback(
    (sourceEntryId: string) => {
      if (isSharedHistory) {
        collabAPI?.markNextHistorySaveAsRestore(sourceEntryId);
        return;
      }

      pendingRestoreRef.current = { sourceEntryId };
      window.setTimeout(() => {
        if (pendingRestoreRef.current?.sourceEntryId === sourceEntryId) {
          pendingRestoreRef.current = null;
        }
      }, 500);
    },
    [collabAPI, isSharedHistory],
  );

  const reconstructEntry = useCallback(
    async (entryId: string) => {
      if (isSharedHistory) {
        if (!collabRoomId || !collabRoomKey || !historyData) {
          return null;
        }

        const payload = await loadSceneHistoryEntryFromFirebase({
          roomId: collabRoomId,
          roomKey: collabRoomKey,
          entryId,
        });
        const entry = historyData.entries.find((item) => item.id === entryId);

        if (!payload || !entry) {
          return null;
        }

        return {
          entry,
          elements: payload.elements,
          appState: resetTransientAppState(
            payload.appState as Partial<AppState>,
          ),
          files: {} as BinaryFiles,
        };
      }

      return SceneHistory.reconstruct(entryId);
    },
    [collabRoomId, collabRoomKey, historyData, isSharedHistory],
  );

  const loadThumbnail = useCallback(
    async (entryId: string): Promise<string | null> => {
      if (!isSharedHistory || !collabRoomId || !collabRoomKey) {
        return null;
      }
      try {
        return await loadSceneHistoryThumbnailFromFirebase({
          roomId: collabRoomId,
          roomKey: collabRoomKey,
          entryId,
        });
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [collabRoomId, collabRoomKey, isSharedHistory],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!excalidrawAPI || isSharedHistory) {
      setHistoryData(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    setIsLoading(true);
    recordQueueRef.current = recordQueueRef.current
      .then(async () => {
        const scene = getCurrentScene(excalidrawAPI);
        const thumbnail = await createHistoryThumbnail(
          scene.elements,
          scene.appState,
          scene.files,
        );
        const nextHistoryData = await SceneHistory.ensureInitialized({
          sessionId: sessionIdRef.current,
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files,
          thumbnail,
        });

        if (isActive && isMountedRef.current) {
          setHistoryState(nextHistoryData);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isActive && isMountedRef.current) {
          setErrorMessage(t("app.history.unavailable"));
        }
      })
      .finally(() => {
        if (isActive && isMountedRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [excalidrawAPI, isSharedHistory, setHistoryState, t]);

  useEffect(() => {
    if (!excalidrawAPI || !collabRoomId || !collabRoomKey) {
      return;
    }

    let isActive = true;

    setHistoryData(null);
    setIsLoading(true);

    const unsubscribe = subscribeSceneHistoryFromFirebase({
      roomId: collabRoomId,
      onChange: (nextHistoryData) => {
        if (isActive && isMountedRef.current) {
          setHistoryState(nextHistoryData);
          setErrorMessage(null);
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.error(error);

        if (isActive && isMountedRef.current) {
          setErrorMessage(t("app.history.sharedUnavailable"));
          setIsLoading(false);
        }
      },
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [collabRoomId, collabRoomKey, excalidrawAPI, setHistoryState, t]);

  useEffect(() => {
    if (!excalidrawAPI || isSharedHistory) {
      return;
    }

    let isActive = true;
    const unsubscribe = excalidrawAPI.onIncrement((increment) => {
      if (increment.type !== "durable" || !("delta" in increment)) {
        return;
      }

      const restoreMetadata = pendingRestoreRef.current;
      if (!isSceneHistoryDeltaRecordable(increment.delta)) {
        if (restoreMetadata) {
          pendingRestoreRef.current = null;
        }
        return;
      }

      const scene = getCurrentScene(excalidrawAPI);
      pendingRestoreRef.current = null;
      recordQueueRef.current = recordQueueRef.current
        .then(async () => {
          const thumbnail = await createHistoryThumbnail(
            scene.elements,
            scene.appState,
            scene.files,
            deriveChangeFocusFromDelta(increment.delta, scene.elements),
          );
          const nextHistoryData = await SceneHistory.append({
            sessionId: sessionIdRef.current,
            elements: scene.elements,
            appState: scene.appState,
            files: scene.files,
            thumbnail,
            delta: increment.delta,
            kind: restoreMetadata ? "restore" : "change",
            restoreSourceId: restoreMetadata?.sourceEntryId,
          });

          if (isActive && isMountedRef.current) {
            setHistoryState(nextHistoryData);
            setErrorMessage(null);
          }
        })
        .catch((error) => {
          console.error(error);
          if (isActive && isMountedRef.current) {
            setErrorMessage(t("app.history.notSaved"));
          }
        });
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [excalidrawAPI, isSharedHistory, setHistoryState, t]);

  const value = useMemo(
    () => ({
      historyData,
      isLoading,
      errorMessage,
      isSharedHistory,
      sessionId: historySessionId,
      markNextChangeAsRestore,
      loadThumbnail,
      reconstructEntry,
    }),
    [
      errorMessage,
      historyData,
      historySessionId,
      isLoading,
      isSharedHistory,
      loadThumbnail,
      markNextChangeAsRestore,
      reconstructEntry,
    ],
  );

  return (
    <SceneHistoryContext.Provider value={value}>
      {children}
    </SceneHistoryContext.Provider>
  );
};

export const HistorySidebar = ({
  collabAPI,
  excalidrawAPI,
  isCollaborating,
}: HistorySidebarProps) => {
  const {
    historyData,
    isLoading,
    errorMessage: historyErrorMessage,
    isSharedHistory,
    sessionId,
    markNextChangeAsRestore,
    loadThumbnail,
    reconstructEntry,
  } = useSceneHistoryContext();
  const { t } = useI18n();
  const previewOriginRef = useRef<PreviewOrigin | null>(null);
  const previewRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const thumbCacheRef = useRef<Map<string, string | null>>(new Map());
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);
  const [previewingEntryId, setPreviewingEntryId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const entries = useMemo(
    () => [...(historyData?.entries ?? [])].reverse(),
    [historyData],
  );

  const selectedEntry = historyData?.entries.find(
    (entry) => entry.id === selectedEntryId,
  );
  const isPreviewing = !!previewEntryId;
  const visibleErrorMessage = errorMessage || historyErrorMessage;
  const showLoading =
    isLoading || (isSharedHistory && !historyData && !visibleErrorMessage);

  const addTargetFilesToScene = useCallback(
    async (target: {
      elements: readonly OrderedExcalidrawElement[];
      files: BinaryFiles;
    }) => {
      addFilesToScene(excalidrawAPI, target.files);

      if (isSharedHistory && collabAPI) {
        const { loadedFiles } = await collabAPI.fetchImageFilesFromFirebase({
          elements: target.elements,
          forceFetchFiles: true,
        });

        if (loadedFiles.length) {
          excalidrawAPI.addFiles(loadedFiles);
        }
      }
    },
    [collabAPI, excalidrawAPI, isSharedHistory],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const element = timelineRef.current;
    if (!element) {
      return;
    }
    const measure = () => setViewportHeight(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isPreviewing) {
      setSelectedEntryId(historyData?.currentEntryId ?? null);
    }
  }, [historyData?.currentEntryId, isPreviewing]);

  const cancelPreview = useCallback(() => {
    previewRequestIdRef.current++;
    setPreviewingEntryId(null);
    const origin = previewOriginRef.current;

    if (!origin) {
      return;
    }

    addFilesToScene(excalidrawAPI, origin.files);
    excalidrawAPI.updateScene({
      elements: origin.elements,
      appState: origin.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
    collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
    previewOriginRef.current = null;
    setPreviewEntryId(null);
    setSelectedEntryId(historyData?.currentEntryId ?? null);
  }, [collabAPI, excalidrawAPI, historyData?.currentEntryId]);

  useEffect(() => {
    return () => {
      const origin = previewOriginRef.current;

      if (!origin || excalidrawAPI.isDestroyed) {
        LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
        collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
        return;
      }

      addFilesToScene(excalidrawAPI, origin.files);
      excalidrawAPI.updateScene({
        elements: origin.elements,
        appState: origin.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
      collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
      previewOriginRef.current = null;
    };
  }, [collabAPI, excalidrawAPI]);

  useEffect(() => {
    if (!isPreviewing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRestoring) {
        event.stopPropagation();
        cancelPreview();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isPreviewing, isRestoring, cancelPreview]);

  const previewEntry = async (entry: SceneHistoryEntry) => {
    if (isRestoring) {
      return;
    }

    if (entry.id === historyData?.currentEntryId) {
      cancelPreview();
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    setPreviewingEntryId(entry.id);

    try {
      if (!previewOriginRef.current) {
        previewOriginRef.current = getCurrentScene(excalidrawAPI);
        LocalData.pauseSave(SCENE_HISTORY_PREVIEW_LOCK);
        if (isSharedHistory && isCollaborating) {
          collabAPI?.pauseSync(SCENE_HISTORY_PREVIEW_LOCK);
        }
      }

      const target = await reconstructEntry(entry.id);

      if (!isMountedRef.current || previewRequestIdRef.current !== requestId) {
        return;
      }

      if (!target) {
        cancelPreview();
        setErrorMessage(t("app.history.restoreError"));
        return;
      }

      await addTargetFilesToScene(target);
      excalidrawAPI.updateScene({
        elements: target.elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          ...target.appState,
          viewModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setSelectedEntryId(entry.id);
      setPreviewEntryId(entry.id);
      setErrorMessage(null);
    } catch (error) {
      if (!isMountedRef.current || previewRequestIdRef.current !== requestId) {
        return;
      }

      console.error(error);
      cancelPreview();
      setErrorMessage(t("app.history.previewError"));
    } finally {
      if (isMountedRef.current && previewRequestIdRef.current === requestId) {
        setPreviewingEntryId(null);
      }
    }
  };

  const restoreSelectedEntry = async () => {
    if (!selectedEntry || selectedEntry.id === historyData?.currentEntryId) {
      return;
    }

    setIsRestoring(true);
    previewRequestIdRef.current++;

    try {
      const target = await reconstructEntry(selectedEntry.id);
      const origin = previewOriginRef.current;

      if (!target) {
        setErrorMessage(t("app.history.restoreError"));
        return;
      }

      if (origin) {
        addFilesToScene(excalidrawAPI, origin.files);
        excalidrawAPI.updateScene({
          elements: origin.elements,
          appState: origin.appState,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }

      LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
      collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
      previewOriginRef.current = null;
      markNextChangeAsRestore(selectedEntry.id);
      await addTargetFilesToScene(target);
      const restoredElements =
        isSharedHistory && isCollaborating
          ? createCollabRestoreElements(
              target.elements,
              excalidrawAPI.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
            )
          : target.elements;
      excalidrawAPI.updateScene({
        elements: restoredElements,
        appState: {
          ...excalidrawAPI.getAppState(),
          ...target.appState,
          viewModeEnabled: origin?.appState.viewModeEnabled ?? false,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      if (isSharedHistory && isCollaborating) {
        collabAPI?.syncElements(restoredElements);
      }
      excalidrawAPI.setToast({ message: t("app.history.restored") });
      setPreviewEntryId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(t("app.history.restoreError"));
    } finally {
      setIsRestoring(false);
    }
  };

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / HISTORY_ROW_HEIGHT) - HISTORY_OVERSCAN,
  );
  const endIndex = Math.min(
    entries.length,
    Math.ceil((scrollTop + viewportHeight) / HISTORY_ROW_HEIGHT) +
      HISTORY_OVERSCAN,
  );
  const visibleEntries = entries.slice(startIndex, endIndex);

  return (
    <div className="history-sidebar">
      <div className="history-sidebar__header">
        <h2>{t("app.history.title")}</h2>
        {historyData && (
          <div className="history-sidebar__count">
            {t("app.history.versions", { count: historyData.entries.length })}
          </div>
        )}
      </div>

      {isCollaborating && isSharedHistory && (
        <div className="history-sidebar__notice">
          {t("app.history.sharedNotice")}
        </div>
      )}

      {visibleErrorMessage && (
        <div className="history-sidebar__notice history-sidebar__notice--error">
          {visibleErrorMessage}
        </div>
      )}

      <div
        className="history-sidebar__timeline"
        role="list"
        ref={timelineRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {showLoading ? (
          <div className="history-sidebar__empty">
            {t("app.history.loading")}
          </div>
        ) : entries.length ? (
          <div
            className="history-sidebar__sizer"
            style={{ height: entries.length * HISTORY_ROW_HEIGHT }}
          >
            {visibleEntries.map((entry, offset) => {
              const index = startIndex + offset;
              const isSelected = entry.id === selectedEntryId;
              const isCurrent = entry.id === historyData?.currentEntryId;

              return (
                <div
                  className="history-sidebar__entry-item"
                  role="listitem"
                  key={entry.id}
                  style={{ top: index * HISTORY_ROW_HEIGHT }}
                >
                  <button
                    className={clsx("history-sidebar__entry", {
                      "history-sidebar__entry--selected": isSelected,
                      "history-sidebar__entry--current": isCurrent,
                    })}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-pressed={isSelected}
                    disabled={isRestoring}
                    onClick={() => previewEntry(entry)}
                    type="button"
                  >
                    <span className="history-sidebar__marker" />
                    <span className="history-sidebar__thumbnail">
                      <HistoryThumbnail
                        entry={entry}
                        cacheRef={thumbCacheRef}
                        loadThumbnail={loadThumbnail}
                      />
                    </span>
                    <span className="history-sidebar__entry-body">
                      <span className="history-sidebar__entry-title">
                        {getEntryTitle(entry, t)}
                        {isCurrent && (
                          <span className="history-sidebar__current-label">
                            {t("app.history.current")}
                          </span>
                        )}
                        {previewingEntryId === entry.id && (
                          <Spinner size={12} />
                        )}
                      </span>
                      <span className="history-sidebar__entry-summary">
                        {entry.summary}
                      </span>
                      <span className="history-sidebar__entry-meta">
                        <time
                          dateTime={new Date(entry.createdAt).toISOString()}
                        >
                          {formatEntryTime(entry.createdAt)}
                        </time>
                        <span>{getEntryAuthorLabel(entry, sessionId, t)}</span>
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="history-sidebar__empty">{t("app.history.empty")}</div>
        )}
      </div>

      {isPreviewing && (
        <div className="history-sidebar__actions">
          <FilledButton
            className="history-sidebar__cancel-button"
            variant="outlined"
            color="muted"
            label={t("app.common.cancel")}
            disabled={isRestoring}
            onClick={cancelPreview}
          />
          <FilledButton
            className="history-sidebar__restore-button"
            label={t("app.history.restore")}
            status={isRestoring ? "loading" : undefined}
            disabled={isRestoring}
            onClick={() => {
              if (isSharedHistory && isCollaborating) {
                setConfirmRestore(true);
                return undefined;
              }
              return restoreSelectedEntry();
            }}
          />
        </div>
      )}

      {confirmRestore && (
        <AppConfirm
          title={t("app.history.restoreTitle")}
          message={t("app.history.restoreMessage")}
          confirmLabel={t("app.history.restore")}
          danger
          onConfirm={async () => {
            await restoreSelectedEntry();
            setConfirmRestore(false);
          }}
          onClose={() => setConfirmRestore(false)}
        />
      )}
    </div>
  );
};
