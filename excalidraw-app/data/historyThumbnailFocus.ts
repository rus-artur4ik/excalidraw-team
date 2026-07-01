import { arrayToMap } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

export type Box = readonly [number, number, number, number];

export type ChangeFocus = {
  changed: OrderedExcalidrawElement[];
  removed: OrderedExcalidrawElement[];
};

type ElementChangeMaps = {
  elements: {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    updated: Record<string, unknown>;
  };
};

export const isChangeFocusEmpty = (focus: ChangeFocus): boolean =>
  focus.changed.length === 0 && focus.removed.length === 0;

export const deriveChangeFocusFromDelta = (
  delta: ElementChangeMaps,
  sceneElementsIncludingDeleted: readonly OrderedExcalidrawElement[],
): ChangeFocus => {
  const byId = arrayToMap(sceneElementsIncludingDeleted);

  const changedIds = new Set([
    ...Object.keys(delta.elements.added),
    ...Object.keys(delta.elements.updated),
  ]);
  const removedIds = new Set(Object.keys(delta.elements.removed));

  const changed: OrderedExcalidrawElement[] = [];
  for (const id of changedIds) {
    const element = byId.get(id);
    if (element && !element.isDeleted) {
      changed.push(element);
    }
  }

  const removed: OrderedExcalidrawElement[] = [];
  for (const id of removedIds) {
    const element = byId.get(id);
    if (element) {
      removed.push({ ...element, isDeleted: false });
    }
  }

  return { changed, removed };
};

export const deriveChangeFocusFromElementDiff = (
  previous: readonly OrderedExcalidrawElement[],
  next: readonly OrderedExcalidrawElement[],
): ChangeFocus => {
  const previousById = arrayToMap(previous);
  const nextById = arrayToMap(next);

  const changed = next.filter((element) => {
    if (element.isDeleted) {
      return false;
    }
    const before = previousById.get(element.id);
    return !before || before.isDeleted || before.version !== element.version;
  });

  const removed: OrderedExcalidrawElement[] = [];
  for (const element of previous) {
    if (element.isDeleted) {
      continue;
    }
    const after = nextById.get(element.id);
    if (!after || after.isDeleted) {
      removed.push({ ...element, isDeleted: false });
    }
  }

  return { changed, removed };
};

export const computeFocusBounds = (focus: ChangeFocus): Box | null => {
  const elements = [...focus.changed, ...focus.removed];
  if (!elements.length) {
    return null;
  }
  return getCommonBounds(elements) as Box;
};

export const expandFocusBounds = (
  bounds: Box,
  sceneBounds: Box,
  marginRatio: number,
): Box => {
  const width = Math.max(bounds[2] - bounds[0], 1);
  const height = Math.max(bounds[3] - bounds[1], 1);
  const marginX = width * marginRatio;
  const marginY = height * marginRatio;

  return [
    Math.max(bounds[0] - marginX, sceneBounds[0]),
    Math.max(bounds[1] - marginY, sceneBounds[1]),
    Math.min(bounds[2] + marginX, sceneBounds[2]),
    Math.min(bounds[3] + marginY, sceneBounds[3]),
  ];
};
