import type { CSSProperties } from "react";

export const pageStyle: CSSProperties = {
  maxWidth: 880,
  margin: "0 auto",
  padding: 24,
  fontFamily: "Assistant, Helvetica, sans-serif",
};

export const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const btn: CSSProperties = {
  padding: "8px 16px",
  background: "#6965db",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

export const linkBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: "#6965db",
  cursor: "pointer",
  marginLeft: 8,
};

export const input: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  flex: 1,
};

export const card: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  marginBottom: 8,
  cursor: "pointer",
};
