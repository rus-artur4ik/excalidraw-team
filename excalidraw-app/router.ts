import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
};

export const navigate = (to: string) => {
  if (to !== window.location.pathname) {
    window.history.pushState({}, "", to);
    emit();
  }
};

export const usePathname = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => window.location.pathname,
  );

export const BOARD_ROUTE_PREFIX = "/b/";

export const getBoardRouteId = (pathname: string): string | null =>
  pathname.startsWith(BOARD_ROUTE_PREFIX)
    ? decodeURIComponent(pathname.slice(BOARD_ROUTE_PREFIX.length)) || null
    : null;
