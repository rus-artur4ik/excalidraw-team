import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useAppT } from "./useAppT";

import { AppDialog } from "./AppDialog";

import type { ReactNode } from "react";

export const AppConfirm = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) => {
  const t = useAppT();
  return (
    <AppDialog title={title} size="small" onClose={onClose}>
      <p className="exa-dialog-intro">{message}</p>
      <div className="exa-dialog-footer">
        <FilledButton
          variant="outlined"
          color="muted"
          label={cancelLabel ?? t("app.common.cancel")}
          onClick={onClose}
        />
        <FilledButton
          color={danger ? "danger" : "primary"}
          label={confirmLabel}
          onClick={onConfirm}
        />
      </div>
    </AppDialog>
  );
};
