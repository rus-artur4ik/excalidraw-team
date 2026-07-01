import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { historyIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { HistorySidebar, SceneHistoryProvider } from "./HistorySidebar";

import "./AppSidebar.scss";

import type { CollabAPI } from "../collab/Collab";

type AppSidebarProps = {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isCollaborating: boolean;
};

export const AppSidebar = ({
  collabAPI,
  excalidrawAPI,
  isCollaborating,
}: AppSidebarProps) => {
  const { t } = useI18n();

  return (
    <SceneHistoryProvider collabAPI={collabAPI} excalidrawAPI={excalidrawAPI}>
      <DefaultSidebar>
        <DefaultSidebar.TabTriggers>
          {excalidrawAPI && (
            <Sidebar.TabTrigger
              className="excalidraw-button sidebar-tab-trigger app-sidebar-tab"
              aria-label={t("app.history.title")}
              tab="history"
              title={t("app.history.title")}
            >
              {historyIcon}
            </Sidebar.TabTrigger>
          )}
        </DefaultSidebar.TabTriggers>
        {excalidrawAPI && (
          <Sidebar.Tab tab="history">
            <HistorySidebar
              collabAPI={collabAPI}
              excalidrawAPI={excalidrawAPI}
              isCollaborating={isCollaborating}
            />
          </Sidebar.Tab>
        )}
      </DefaultSidebar>
    </SceneHistoryProvider>
  );
};
