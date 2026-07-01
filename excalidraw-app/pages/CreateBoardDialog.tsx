import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import { useState } from "react";

import { useAppT } from "../components/useAppT";

import { AppDialog } from "../components/AppDialog";
import { DEFAULT_BOT_POLICY, createBoard } from "../data/boards";
import { navigate } from "../router";

import { BOT_POLICY_OPTIONS, VISIBILITY_OPTIONS } from "./boardOptions";

import type { BotPolicy, Visibility } from "../data/boards";

export const CreateBoardDialog = ({
  allowTeam,
  onClose,
}: {
  allowTeam: boolean;
  onClose: () => void;
}) => {
  const t = useAppT();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [botPolicy, setBotPolicy] = useState<BotPolicy>(DEFAULT_BOT_POLICY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibilityChoices = VISIBILITY_OPTIONS.filter(
    (option) => option.value !== "team" || allowTeam,
  ).map((option) => ({
    value: option.value,
    label: t(option.labelKey),
    ariaLabel: t(option.labelKey),
  }));

  const hintKey = VISIBILITY_OPTIONS.find(
    (o) => o.value === visibility,
  )?.hintKey;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await createBoard({
        title: title.trim() || t("app.common.untitled"),
        visibility,
        botPolicy,
      });
      navigate(`/b/${roomId}`);
    } catch (err) {
      console.error(err);
      setError(t("app.create.error"));
      setBusy(false);
    }
  };

  return (
    <AppDialog
      title={t("app.create.title")}
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
          label={t("app.create.name")}
          value={title}
          placeholder={t("app.common.untitled")}
          selectOnRender
          onChange={setTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void create();
            }
          }}
        />
      </div>

      <div className="exa-section">
        <span className="exa-label">{t("app.create.access")}</span>
        <RadioGroup
          name="create-visibility"
          value={visibility}
          choices={visibilityChoices}
          onChange={setVisibility}
        />
        {hintKey && <p className="exa-hint">{t(hintKey)}</p>}
      </div>

      <div className="exa-section">
        <span className="exa-label">{t("app.create.botAccess")}</span>
        <RadioGroup
          name="create-bot-policy"
          value={botPolicy}
          choices={BOT_POLICY_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
            ariaLabel: t(option.labelKey),
          }))}
          onChange={setBotPolicy}
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
        <FilledButton label={t("app.common.create")} onClick={create} />
      </div>
    </AppDialog>
  );
};
