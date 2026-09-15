import { useEffect, useRef } from "react";

/**
 * Closes a popover on outside pointer-down or Escape. Returns the ref to put
 * on the popover's wrapper (trigger + menu) so clicks inside don't dismiss.
 */
export const useDismissable = <T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) => {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return ref;
};
