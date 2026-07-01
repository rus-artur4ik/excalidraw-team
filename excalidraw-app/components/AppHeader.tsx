import {
  ExcalLogo,
  ExportIcon,
  loginIcon,
  MoonIcon,
  SunIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { navigate } from "../router";

import { useAppT } from "./useAppT";

import {
  getStoredThemePref,
  setStoredThemePref,
  useResolvedTheme,
} from "./useResolvedTheme";

import type { AppUser } from "../data/firebase";

const initials = (user: AppUser): string => {
  const source = user.displayName || user.email || "?";
  return source.trim().charAt(0).toUpperCase();
};

export const AppHeader = ({
  user,
  isAdmin,
  onOpenMcp,
}: {
  user: AppUser;
  isAdmin: boolean;
  onOpenMcp?: () => void;
}) => {
  const t = useAppT();
  const { signOut } = useAuth();
  const theme = useResolvedTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleTheme = () => {
    const current = getStoredThemePref();
    const resolved =
      current === "system" ? theme : (current as "light" | "dark");
    setStoredThemePref(resolved === "dark" ? "light" : "dark");
  };

  return (
    <header className="exa-topbar">
      <button
        type="button"
        className="exa-brand"
        onClick={() => navigate("/")}
        title={t("app.common.backToBoards")}
      >
        {ExcalLogo}
        {t("app.brand")}
      </button>

      <div className="exa-account" ref={menuRef}>
        <button
          type="button"
          className="exa-account__trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="exa-avatar" aria-hidden="true">
            {initials(user)}
          </span>
          {user.displayName ?? user.email}
        </button>

        {open && (
          <div className="exa-menu" role="menu">
            <div className="exa-menu__name">{user.email}</div>
            <div className="exa-menu__sep" />
            {onOpenMcp && (
              <button
                type="button"
                role="menuitem"
                className="exa-menu__item"
                onClick={() => {
                  setOpen(false);
                  onOpenMcp();
                }}
              >
                {ExportIcon}
                {t("app.header.connectAi")}
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                className="exa-menu__item"
                onClick={() => {
                  setOpen(false);
                  navigate("/admin");
                }}
              >
                {usersIcon}
                {t("app.header.team")}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="exa-menu__item"
              onClick={toggleTheme}
            >
              {theme === "dark" ? SunIcon : MoonIcon}
              {theme === "dark"
                ? t("app.header.lightTheme")
                : t("app.header.darkTheme")}
            </button>
            <div className="exa-menu__sep" />
            <button
              type="button"
              role="menuitem"
              className="exa-menu__item exa-menu__item--danger"
              onClick={() => {
                setOpen(false);
                signOut().catch((error) => console.error(error));
              }}
            >
              {loginIcon}
              {t("app.header.signOut")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
