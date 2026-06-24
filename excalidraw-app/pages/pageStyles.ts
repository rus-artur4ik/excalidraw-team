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

export const cardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
  padding: 0,
  margin: 0,
  listStyle: "none",
};

export const boardCard: CSSProperties = {
  border: "1px solid #e0e0e0",
  borderRadius: 10,
  overflow: "hidden",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
};

export const thumbBox: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 10",
  background:
    "repeating-conic-gradient(#f4f4f6 0% 25%, #fafafb 0% 50%) 50% / 18px 18px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

export const thumbImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

export const badge: CSSProperties = {
  fontSize: 11,
  color: "#666",
  background: "#f0f0f4",
  borderRadius: 999,
  padding: "2px 8px",
};

export const skeletonShimmer: CSSProperties = {
  width: "100%",
  height: "100%",
  background:
    "linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%)",
  backgroundSize: "400% 100%",
  animation: "boardSkeleton 1.4s ease infinite",
};
