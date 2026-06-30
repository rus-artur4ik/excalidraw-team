import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { useAtomValue, useSetAtom } from "../app-jotai";
import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { currentUserAtom } from "../auth/atoms";
import {
  boardCanManageAtom,
  boardSettingsOpenAtom,
  currentBoardAtom,
} from "../boardSession";
import { signOutFromApp } from "../data/firebase";
import { navigate } from "../router";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const user = useAtomValue(currentUserAtom);
  const currentBoard = useAtomValue(currentBoardAtom);
  const canManageBoard = useAtomValue(boardCanManageAtom);
  const openBoardSettings = useSetAtom(boardSettingsOpenAtom);
  return (
    <MainMenu>
      {user && (
        <>
          <MainMenu.Item icon={loginIcon} onSelect={() => navigate("/")}>
            My boards
          </MainMenu.Item>
          {currentBoard && canManageBoard && (
            <MainMenu.Item
              icon={settingsIcon}
              onSelect={() => openBoardSettings(true)}
            >
              Board settings
            </MainMenu.Item>
          )}
          <MainMenu.Item
            icon={loginIcon}
            onSelect={() => {
              signOutFromApp()
                .then(() => navigate("/"))
                .catch((error) => console.error(error));
            }}
          >
            Sign out ({user.displayName ?? user.email})
          </MainMenu.Item>
          <MainMenu.Separator />
        </>
      )}
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={ExcalLogo}
        href={`${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className=""
      >
        Excalidraw+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.ItemLink
        icon={loginIcon}
        href={`${import.meta.env.VITE_APP_PLUS_APP}${
          isExcalidrawPlusSignedUser ? "" : "/sign-up"
        }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
        className="highlighted"
      >
        {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
      </MainMenu.ItemLink>
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
