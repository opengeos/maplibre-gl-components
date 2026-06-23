import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookmarkControl } from "../src/lib/core/BookmarkControl";
import type { MapBookmark } from "../src/lib/core/types";

// jsdom in this project's vitest setup does not expose localStorage; the control
// degrades gracefully without it, but provide a simple in-memory stub so the
// persistence paths are exercised.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function makeMap() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    hasControl: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: vi.fn().mockReturnValue(5),
    getCenter: vi.fn().mockReturnValue({ lng: -98, lat: 38.5 }),
    getPitch: vi.fn().mockReturnValue(0),
    getBearing: vi.fn().mockReturnValue(0),
    flyTo: vi.fn(),
    getCanvas: vi.fn().mockReturnValue({ width: 800, height: 600 }),
  };
}

describe("BookmarkControl", () => {
  let map: ReturnType<typeof makeMap>;

  beforeEach(() => {
    localStorage.clear();
    map = makeMap();
  });

  function mount(options?: ConstructorParameters<typeof BookmarkControl>[0]) {
    const control = new BookmarkControl({ collapsed: false, ...options });
    const container = control.onAdd(map as never);
    document.body.appendChild(container);
    return { control, container };
  }

  describe("constructor / onAdd", () => {
    it("creates the container and bookmark button", () => {
      const { container } = mount({ collapsed: true });
      expect(container.classList.contains("maplibregl-ctrl")).toBe(true);
      expect(container.classList.contains("maplibre-gl-bookmark-control")).toBe(
        true,
      );
      expect(container.querySelector(".bookmark-button")).not.toBeNull();
    });

    it("renders the panel when not collapsed", () => {
      const { container } = mount();
      expect(container.querySelector(".bookmark-panel")).not.toBeNull();
    });
  });

  describe("resizable panel (468)", () => {
    it("marks the panel resizable by default", () => {
      const { container } = mount();
      const panel = container.querySelector(".bookmark-panel");
      expect(panel?.classList.contains("resizable")).toBe(true);
    });

    it("does not mark the panel resizable when disabled", () => {
      const { container } = mount({ resizable: false });
      const panel = container.querySelector(".bookmark-panel");
      expect(panel?.classList.contains("resizable")).toBe(false);
    });
  });

  describe("capture / restore host state (467)", () => {
    it("stores captured state as the bookmark's extra", () => {
      const captureState = vi
        .fn()
        .mockReturnValue({ visibleLayerIds: ["a", "b"] });
      const { control } = mount({ captureState });
      control.addBookmark("with layers");
      const [bookmark] = control.getBookmarks();
      expect(captureState).toHaveBeenCalled();
      expect(bookmark.extra).toEqual({ visibleLayerIds: ["a", "b"] });
    });

    it("calls restoreState with the stored extra when opening", () => {
      const restoreState = vi.fn();
      const { control } = mount({
        captureState: () => ({ visibleLayerIds: ["x"] }),
        restoreState,
      });
      control.addBookmark("a");
      const [bookmark] = control.getBookmarks();
      control.goTo(bookmark.id);
      expect(restoreState).toHaveBeenCalledWith({ visibleLayerIds: ["x"] });
    });

    it("does not restore when a bookmark has no extra", () => {
      const restoreState = vi.fn();
      const { control } = mount({ restoreState });
      control.addBookmark("plain");
      const [bookmark] = control.getBookmarks();
      control.goTo(bookmark.id);
      expect(restoreState).not.toHaveBeenCalled();
    });

    it("respects the capture toggle when a label is provided", () => {
      const captureState = vi.fn().mockReturnValue({ a: 1 });
      const { control, container } = mount({
        captureState,
        captureStateLabel: "Include layers",
        captureStateDefault: false,
      });
      // Toggle starts unchecked -> no capture.
      control.addBookmark("no-capture");
      expect(captureState).not.toHaveBeenCalled();

      const checkbox = container.querySelector(
        ".bookmark-capture-checkbox",
      ) as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
      control.addBookmark("capture");
      expect(captureState).toHaveBeenCalledTimes(1);
    });
  });

  describe("selective export (470)", () => {
    it("exports all bookmarks when nothing is selected", () => {
      const { control } = mount({ selectable: true });
      control.addBookmark("a");
      control.addBookmark("b");
      const exported = JSON.parse(control.exportBookmarks()) as MapBookmark[];
      expect(exported).toHaveLength(2);
    });

    it("exports only the selected subset", () => {
      const { control } = mount({ selectable: true });
      control.addBookmark("a");
      control.addBookmark("b");
      const ids = control.getBookmarks().map((b) => b.id);
      control.setSelectedIds([ids[0]]);
      const exported = JSON.parse(control.exportBookmarks()) as MapBookmark[];
      expect(exported.map((b) => b.id)).toEqual([ids[0]]);
    });

    it("prunes deleted bookmarks from the selection", () => {
      const { control } = mount({ selectable: true });
      control.addBookmark("a");
      const [bookmark] = control.getBookmarks();
      control.setSelectedIds([bookmark.id]);
      control.removeBookmark(bookmark.id);
      expect(control.getSelectedIds()).toEqual([]);
    });
  });

  describe("metadata visibility (794)", () => {
    it("shows the zoom/date meta line by default", () => {
      const { control, container } = mount();
      control.addBookmark("a");
      expect(container.querySelector(".bookmark-meta")).not.toBeNull();
    });

    it("hides the meta line when showMetadata is false", () => {
      const { control, container } = mount({ showMetadata: false });
      control.addBookmark("a");
      expect(container.querySelector(".bookmark-meta")).toBeNull();
      // The name is still rendered as the identifier.
      expect(container.querySelector(".bookmark-name")?.textContent).toBe("a");
    });
  });

  describe("capture tooltip (794)", () => {
    it("renders an info icon when captureStateTooltip is set", () => {
      const { container } = mount({
        captureState: () => ({ a: 1 }),
        captureStateLabel: "Include layers",
        captureStateTooltip: "Applies to the next bookmark only.",
      });
      const info = container.querySelector(
        ".bookmark-capture-info",
      ) as HTMLElement | null;
      expect(info).not.toBeNull();
      expect(info?.title).toBe("Applies to the next bookmark only.");
    });

    it("omits the info icon when no tooltip is provided", () => {
      const { container } = mount({
        captureState: () => ({ a: 1 }),
        captureStateLabel: "Include layers",
      });
      expect(container.querySelector(".bookmark-capture-info")).toBeNull();
    });
  });

  describe("export labels and Export All (794)", () => {
    it("morphs the Export label to Export Selected when a subset is ticked", () => {
      const { control, container } = mount({ selectable: true });
      control.addBookmark("a");
      control.addBookmark("b");
      const labelOf = () =>
        container.querySelector(".bookmark-export-btn span")?.textContent;
      expect(labelOf()).toBe("Export");
      control.setSelectedIds(control.getBookmarks().map((b) => b.id).slice(0, 1));
      expect(labelOf()).toBe("Export Selected");
      control.setSelectedIds([]);
      expect(labelOf()).toBe("Export");
    });

    it("honors custom export label overrides", () => {
      const { control, container } = mount({
        selectable: true,
        exportLabel: "Save",
        exportSelectedLabel: "Save Picked",
      });
      control.addBookmark("a");
      expect(container.querySelector(".bookmark-export-btn span")?.textContent).toBe(
        "Save",
      );
      control.setSelectedIds(control.getBookmarks().map((b) => b.id));
      expect(container.querySelector(".bookmark-export-btn span")?.textContent).toBe(
        "Save Picked",
      );
    });

    it("renders a dedicated Export All button and a conditional Export Selected button", () => {
      const { control, container } = mount({
        selectable: true,
        showExportAll: true,
      });
      control.addBookmark("a");
      control.addBookmark("b");
      expect(container.querySelector(".bookmark-export-all-btn")).not.toBeNull();
      // No selection -> no Export Selected button.
      expect(container.querySelector(".bookmark-export-selected-btn")).toBeNull();
      control.setSelectedIds(control.getBookmarks().map((b) => b.id).slice(0, 1));
      expect(
        container.querySelector(".bookmark-export-selected-btn"),
      ).not.toBeNull();
      control.setSelectedIds([]);
      expect(container.querySelector(".bookmark-export-selected-btn")).toBeNull();
    });

    it("exportBookmarks('all') ignores the selection", () => {
      const { control } = mount({ selectable: true });
      control.addBookmark("a");
      control.addBookmark("b");
      control.setSelectedIds(control.getBookmarks().map((b) => b.id).slice(0, 1));
      const all = JSON.parse(control.exportBookmarks("all")) as MapBookmark[];
      expect(all).toHaveLength(2);
      const selected = JSON.parse(
        control.exportBookmarks("selected"),
      ) as MapBookmark[];
      expect(selected).toHaveLength(1);
    });
  });

  describe("reordering (471)", () => {
    it("renders draggable items with a grip when reorderable", () => {
      const { control, container } = mount({ reorderable: true });
      control.addBookmark("a");
      const item = container.querySelector(".bookmark-item");
      expect(item?.getAttribute("draggable")).toBe("true");
      expect(item?.querySelector(".bookmark-grip")).not.toBeNull();
    });

    it("does not render grips when reordering is disabled", () => {
      const { control, container } = mount({ reorderable: false });
      control.addBookmark("a");
      const item = container.querySelector(".bookmark-item");
      expect(item?.getAttribute("draggable")).toBeNull();
      expect(container.querySelector(".bookmark-grip")).toBeNull();
    });
  });
});
