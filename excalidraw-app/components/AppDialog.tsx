import { KEYS, queryFocusableElements } from "@excalidraw/common";
import { CloseIcon } from "@excalidraw/excalidraw/components/icons";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useAppT } from "./useAppT";

import { useResolvedTheme } from "./useResolvedTheme";

import type { CSSProperties, ReactNode } from "react";

const SIZE_PX: Record<string, number> = {
  small: 460,
  regular: 640,
  wide: 880,
};

export const AppDialog = ({
  title,
  children,
  onClose,
  size = "small",
  closeOnBackdrop = true,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  size?: "small" | "regular" | "wide" | number;
  closeOnBackdrop?: boolean;
}) => {
  const t = useAppT();
  const theme = useResolvedTheme();
  const islandRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  if (!containerRef.current && typeof document !== "undefined") {
    containerRef.current = document.createElement("div");
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const lastActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.appendChild(container);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      container.remove();
      lastActive?.focus?.();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.className = clsx("excalidraw", "excalidraw-modal-container", {
      "theme--dark": theme === "dark",
    });
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.zIndex = "1000";
  }, [theme]);

  useEffect(() => {
    const island = islandRef.current;
    if (!island) {
      return;
    }
    const focusables = queryFocusableElements(island);
    const timer = window.setTimeout(() => {
      (focusables[1] || focusables[0])?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== KEYS.TAB) {
        return;
      }
      const list = queryFocusableElements(island);
      const index = list.findIndex((el) => el === document.activeElement);
      if (index === 0 && event.shiftKey) {
        list[list.length - 1].focus();
        event.preventDefault();
      } else if (index === list.length - 1 && !event.shiftKey) {
        list[0].focus();
        event.preventDefault();
      }
    };
    island.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      island.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!containerRef.current) {
    return null;
  }

  const maxWidth = typeof size === "number" ? size : SIZE_PX[size];

  return createPortal(
    <div
      className="Modal Dialog AppDialog"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      onKeyDown={(event) => {
        if (event.key === KEYS.ESCAPE) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="Modal__background"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className="Modal__content"
        style={{ "--max-width": `${maxWidth}px` } as CSSProperties}
        tabIndex={0}
      >
        <div className="Island" ref={islandRef}>
          {title && (
            <h2 className="Dialog__title">
              <span className="Dialog__titleContent">{title}</span>
            </h2>
          )}
          <div className="Dialog__content">{children}</div>
          <button
            className="Dialog__close"
            onClick={onClose}
            aria-label={t("app.common.close")}
            title={t("app.common.close")}
            type="button"
          >
            {CloseIcon}
          </button>
        </div>
      </div>
    </div>,
    containerRef.current,
  );
};
