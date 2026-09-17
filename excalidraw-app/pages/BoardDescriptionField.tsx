import { useId } from "react";

import { useAppT } from "../components/useAppT";

import { BOARD_DESCRIPTION_MAX_LENGTH } from "../data/boards";

/**
 * Multi-line input styled like the editor's TextField. The description is
 * stored as one paragraph, so Enter never inserts a line break: it runs
 * `onEnter` (e.g. submit) instead.
 */
export const BoardDescriptionField = ({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) => {
  const t = useAppT();
  const id = useId();

  return (
    <div className="ExcTextField exa-textarea">
      <label className="ExcTextField__label" htmlFor={id}>
        {t("app.boardDescription.label")}
      </label>
      <div className="ExcTextField__input">
        <textarea
          id={id}
          rows={3}
          value={value}
          maxLength={BOARD_DESCRIPTION_MAX_LENGTH}
          placeholder={t("app.boardDescription.placeholder")}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onEnter?.();
            }
          }}
        />
      </div>
      <p className="exa-hint exa-textarea__hint">
        <span>{t("app.boardDescription.hint")}</span>
        <span aria-hidden="true">
          {value.length}/{BOARD_DESCRIPTION_MAX_LENGTH}
        </span>
      </p>
    </div>
  );
};
