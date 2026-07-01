import { isTestEnv } from "@excalidraw/common";
import {
  getCommonBounds,
  getNonDeletedElements,
  getRootElements,
} from "@excalidraw/element";
import { clamp } from "@excalidraw/math";
import { exportToCanvas } from "@excalidraw/utils/export";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import type { Box, ChangeFocus } from "./historyThumbnailFocus";
import {
  computeFocusBounds,
  expandFocusBounds,
  isChangeFocusEmpty,
} from "./historyThumbnailFocus";

const THUMBNAIL_MAX_WIDTH = 160;
const THUMBNAIL_MAX_HEIGHT = 96;
const THUMBNAIL_QUALITY = 0.8;

const FOCUS_MARGIN_RATIO = 0.2;
const FOCUS_PADDING = 4;
const MAX_FULL_DIMENSION = 4096;
const MAX_FOCUS_SCALE = 3;
const SCRIM_ALPHA = 0.55;
const SCRIM_COLOR_LIGHT = "#ffffff";
const SCRIM_COLOR_DARK = "#121212";
const CHANGED_OUTLINE_COLOR = "#4a47b1";
const REMOVED_OUTLINE_COLOR = "#db6965";
const REMOVED_GHOST_OPACITY = 25;
const OUTLINE_WIDTH = 2;

let webpSupported: boolean | null = null;

const supportsWebp = (): boolean => {
  if (webpSupported !== null) {
    return webpSupported;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupported = canvas
      .toDataURL("image/webp")
      .startsWith("data:image/webp");
  } catch {
    webpSupported = false;
  }
  return webpSupported;
};

const exportAppState = (appState: AppState) => ({
  exportBackground: true,
  exportScale: 1,
  exportWithDarkMode: appState.exportWithDarkMode,
  viewBackgroundColor: appState.viewBackgroundColor,
  frameRendering: { enabled: true, clip: true, name: false, outline: true },
});

const renderWholeBoardCanvas = (
  nonDeletedElements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) =>
  exportToCanvas({
    elements: nonDeletedElements,
    appState: exportAppState(appState),
    files,
    exportPadding: 12,
    getDimensions: (width, height) => {
      const scale = Math.min(
        THUMBNAIL_MAX_WIDTH / width,
        THUMBNAIL_MAX_HEIGHT / height,
        1,
      );

      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scale,
      };
    },
  });

const renderFocusedCanvas = async (
  nonDeletedElements: readonly OrderedExcalidrawElement[],
  focus: ChangeFocus,
  appState: AppState,
  files: BinaryFiles,
): Promise<HTMLCanvasElement> => {
  const focusBounds = computeFocusBounds(focus);
  if (!focusBounds) {
    return renderWholeBoardCanvas(nonDeletedElements, appState, files);
  }

  const ghosts = focus.removed.map((element) => ({
    ...element,
    isDeleted: false,
    opacity: REMOVED_GHOST_OPACITY,
  }));
  const renderElements = [...nonDeletedElements, ...ghosts];

  const sceneBounds = getCommonBounds(getRootElements(renderElements)) as Box;
  const expanded = expandFocusBounds(
    focusBounds,
    sceneBounds,
    FOCUS_MARGIN_RATIO,
  );

  const focusWidth = Math.max(expanded[2] - expanded[0], 1);
  const focusHeight = Math.max(expanded[3] - expanded[1], 1);
  const sceneWidth = Math.max(sceneBounds[2] - sceneBounds[0], 1);
  const sceneHeight = Math.max(sceneBounds[3] - sceneBounds[1], 1);

  const focusScale = Math.min(
    THUMBNAIL_MAX_WIDTH / focusWidth,
    THUMBNAIL_MAX_HEIGHT / focusHeight,
  );
  const dimensionCap = Math.min(
    MAX_FULL_DIMENSION / (sceneWidth + FOCUS_PADDING * 2),
    MAX_FULL_DIMENSION / (sceneHeight + FOCUS_PADDING * 2),
  );
  const scale = Math.min(focusScale, MAX_FOCUS_SCALE, dimensionCap);

  const full = await exportToCanvas({
    elements: renderElements as readonly OrderedExcalidrawElement[],
    appState: exportAppState(appState),
    files,
    exportPadding: FOCUS_PADDING,
    getDimensions: (width, height) => ({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale,
    }),
  });

  const toCanvasX = (worldX: number) =>
    (worldX - sceneBounds[0] + FOCUS_PADDING) * scale;
  const toCanvasY = (worldY: number) =>
    (worldY - sceneBounds[1] + FOCUS_PADDING) * scale;

  const cropX = clamp(toCanvasX(expanded[0]), 0, full.width);
  const cropY = clamp(toCanvasY(expanded[1]), 0, full.height);
  const cropW = clamp(toCanvasX(expanded[2]) - cropX, 1, full.width - cropX);
  const cropH = clamp(toCanvasY(expanded[3]) - cropY, 1, full.height - cropY);

  const outputScale = Math.min(
    THUMBNAIL_MAX_WIDTH / cropW,
    THUMBNAIL_MAX_HEIGHT / cropH,
  );
  const thumb = document.createElement("canvas");
  thumb.width = Math.max(1, Math.round(cropW * outputScale));
  thumb.height = Math.max(1, Math.round(cropH * outputScale));
  const ctx = thumb.getContext("2d");
  if (!ctx) {
    return renderWholeBoardCanvas(nonDeletedElements, appState, files);
  }

  const scaleX = thumb.width / cropW;
  const scaleY = thumb.height / cropH;

  ctx.drawImage(
    full,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    thumb.width,
    thumb.height,
  );

  ctx.save();
  ctx.globalAlpha = SCRIM_ALPHA;
  ctx.fillStyle = appState.exportWithDarkMode
    ? SCRIM_COLOR_DARK
    : SCRIM_COLOR_LIGHT;
  ctx.fillRect(0, 0, thumb.width, thumb.height);
  ctx.restore();

  const toThumbRect = (box: Box) => ({
    x: (toCanvasX(box[0]) - cropX) * scaleX,
    y: (toCanvasY(box[1]) - cropY) * scaleY,
    w: (box[2] - box[0]) * scale * scaleX,
    h: (box[3] - box[1]) * scale * scaleY,
  });

  for (const element of focus.changed) {
    const box = getCommonBounds([element]) as Box;
    const rect = toThumbRect(box);
    const sx = clamp(toCanvasX(box[0]), 0, full.width);
    const sy = clamp(toCanvasY(box[1]), 0, full.height);
    const sw = clamp(toCanvasX(box[2]) - sx, 0, full.width - sx);
    const sh = clamp(toCanvasY(box[3]) - sy, 0, full.height - sy);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(full, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.strokeStyle = CHANGED_OUTLINE_COLOR;
    ctx.setLineDash([]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  for (const element of ghosts) {
    const box = getCommonBounds([element]) as Box;
    const rect = toThumbRect(box);
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.strokeStyle = REMOVED_OUTLINE_COLOR;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.setLineDash([]);

  return thumb;
};

export const createHistoryThumbnail = async (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  focus?: ChangeFocus,
): Promise<string | null> => {
  const nonDeletedElements = getNonDeletedElements(elements);

  if (!nonDeletedElements.length || isTestEnv()) {
    return null;
  }

  try {
    const canvas =
      focus && !isChangeFocusEmpty(focus)
        ? await renderFocusedCanvas(nonDeletedElements, focus, appState, files)
        : await renderWholeBoardCanvas(nonDeletedElements, appState, files);

    const mimeType = supportsWebp() ? "image/webp" : "image/png";
    return canvas.toDataURL(mimeType, THUMBNAIL_QUALITY);
  } catch (error) {
    console.warn("Failed to render scene history thumbnail:", error);
    return null;
  }
};
