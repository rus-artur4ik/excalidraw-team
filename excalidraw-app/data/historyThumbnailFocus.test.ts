import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import {
  computeFocusBounds,
  deriveChangeFocusFromDelta,
  deriveChangeFocusFromElementDiff,
  expandFocusBounds,
  isChangeFocusEmpty,
} from "./historyThumbnailFocus";

const el = (
  overrides: Partial<OrderedExcalidrawElement>,
): OrderedExcalidrawElement =>
  ({
    id: "x",
    type: "rectangle",
    isDeleted: false,
    version: 1,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    ...overrides,
  } as OrderedExcalidrawElement);

const delta = (parts: {
  added?: string[];
  updated?: string[];
  removed?: string[];
}) => ({
  elements: {
    added: Object.fromEntries((parts.added ?? []).map((id) => [id, {}])),
    updated: Object.fromEntries((parts.updated ?? []).map((id) => [id, {}])),
    removed: Object.fromEntries((parts.removed ?? []).map((id) => [id, {}])),
  },
});

describe("historyThumbnailFocus", () => {
  describe("isChangeFocusEmpty", () => {
    it("is true when nothing changed", () => {
      expect(isChangeFocusEmpty({ changed: [], removed: [] })).toBe(true);
    });

    it("is false when something changed", () => {
      expect(
        isChangeFocusEmpty({ changed: [el({ id: "a" })], removed: [] }),
      ).toBe(false);
    });
  });

  describe("deriveChangeFocusFromDelta", () => {
    it("collects added and updated as changed, removed (soft-deleted) as removed", () => {
      const scene = [
        el({ id: "a" }),
        el({ id: "b" }),
        el({ id: "c", isDeleted: true }),
      ];
      const focus = deriveChangeFocusFromDelta(
        delta({ added: ["a"], updated: ["b"], removed: ["c"] }),
        scene,
      );

      expect(focus.changed.map((e) => e.id).sort()).toEqual(["a", "b"]);
      expect(focus.removed.map((e) => e.id)).toEqual(["c"]);
      expect(focus.removed[0].isDeleted).toBe(false);
    });

    it("skips ids that are not present in the scene", () => {
      const focus = deriveChangeFocusFromDelta(
        delta({ added: ["missing"], removed: ["gone"] }),
        [el({ id: "a" })],
      );
      expect(focus.changed).toEqual([]);
      expect(focus.removed).toEqual([]);
    });
  });

  describe("deriveChangeFocusFromElementDiff", () => {
    it("treats new and version-bumped elements as changed", () => {
      const previous = [
        el({ id: "a", version: 1 }),
        el({ id: "b", version: 1 }),
      ];
      const next = [
        el({ id: "a", version: 2 }),
        el({ id: "b", version: 1 }),
        el({ id: "c", version: 1 }),
      ];
      const focus = deriveChangeFocusFromElementDiff(previous, next);
      expect(focus.changed.map((e) => e.id).sort()).toEqual(["a", "c"]);
      expect(focus.removed).toEqual([]);
    });

    it("treats elements that became deleted or vanished as removed", () => {
      const previous = [
        el({ id: "d", version: 1 }),
        el({ id: "e", version: 1 }),
      ];
      const next = [el({ id: "d", version: 1, isDeleted: true })];
      const focus = deriveChangeFocusFromElementDiff(previous, next);
      expect(focus.changed).toEqual([]);
      expect(focus.removed.map((e) => e.id).sort()).toEqual(["d", "e"]);
      expect(focus.removed.every((e) => e.isDeleted === false)).toBe(true);
    });
  });

  describe("computeFocusBounds", () => {
    it("returns null when nothing changed", () => {
      expect(computeFocusBounds({ changed: [], removed: [] })).toBeNull();
    });

    it("returns the common bounds of the changed elements", () => {
      const rect = API.createElement({
        type: "rectangle",
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      }) as OrderedExcalidrawElement;
      const bounds = computeFocusBounds({ changed: [rect], removed: [] });
      expect(bounds).toEqual([10, 20, 40, 60]);
    });
  });

  describe("expandFocusBounds", () => {
    it("grows the box by the margin ratio", () => {
      expect(
        expandFocusBounds([10, 10, 20, 20], [0, 0, 100, 100], 0.2),
      ).toEqual([8, 8, 22, 22]);
    });

    it("never grows beyond the scene bounds", () => {
      expect(
        expandFocusBounds([0, 0, 100, 100], [0, 0, 100, 100], 0.2),
      ).toEqual([0, 0, 100, 100]);
    });
  });
});
