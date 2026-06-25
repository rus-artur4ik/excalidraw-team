import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

const SPINNER_KEYFRAMES_ID = "app-spinner-keyframes";

const ensureSpinnerKeyframes = () => {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(SPINNER_KEYFRAMES_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = SPINNER_KEYFRAMES_ID;
  style.textContent =
    "@keyframes appSpinnerRotate { to { transform: rotate(360deg) } }";
  document.head.appendChild(style);
};

export const Spinner = ({
  size = 14,
  style,
}: {
  size?: number;
  style?: CSSProperties;
}) => {
  ensureSpinnerKeyframes();
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "appSpinnerRotate 0.7s linear infinite",
        ...style,
      }}
    />
  );
};

type BusyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: ReactNode;
  spinnerSize?: number;
};

export const BusyButton = ({
  busy = false,
  busyLabel,
  spinnerSize = 13,
  children,
  style,
  disabled,
  ...rest
}: BusyButtonProps) => {
  const inactive = busy || disabled;
  return (
    <button
      {...rest}
      disabled={inactive}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...style,
        ...(inactive ? { opacity: 0.6, cursor: "default" } : null),
      }}
    >
      {busy && <Spinner size={spinnerSize} />}
      {busy && busyLabel != null ? busyLabel : children}
    </button>
  );
};
