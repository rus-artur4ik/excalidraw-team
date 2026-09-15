import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import { useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppDialog } from "../components/AppDialog";
import { cleanFolderName } from "../data/folders";

export const FolderDialog = ({
  mode,
  initialName = "",
  onSubmit,
  onClose,
}: {
  mode: "create" | "rename";
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) => {
  const t = useAppT();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleaned = cleanFolderName(name);
  const canSubmit = cleaned.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(cleaned);
    } catch (err) {
      console.error(err);
      setError(t("app.folders.saveError"));
      setBusy(false);
    }
  };

  return (
    <AppDialog
      title={
        mode === "create"
          ? t("app.folders.createTitle")
          : t("app.folders.renameTitle")
      }
      size="small"
      closeOnBackdrop={!busy}
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div className="exa-section">
        <TextField
          label={t("app.folders.name")}
          value={name}
          placeholder={t("app.folders.namePlaceholder")}
          selectOnRender
          onChange={setName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void submit();
            }
          }}
        />
      </div>

      {error && (
        <p className="exa-error-text" role="alert">
          {error}
        </p>
      )}

      <div className="exa-dialog-footer">
        <FilledButton
          variant="outlined"
          color="muted"
          label={t("app.common.cancel")}
          disabled={busy}
          onClick={onClose}
        />
        <FilledButton
          label={
            mode === "create" ? t("app.common.create") : t("app.common.save")
          }
          status={busy ? "loading" : undefined}
          disabled={!canSubmit}
          onClick={submit}
        />
      </div>
    </AppDialog>
  );
};
