import { describe, it, expect, beforeEach, vi } from "vitest";
import { ViewStateControl } from "../src/lib/core/ViewStateControl";

function createMockMap(projectionType = "globe"): any {
  return {
    on: vi.fn(),
    off: vi.fn(),
    getCenter: vi.fn().mockReturnValue({ lng: -98, lat: 38.5 }),
    getBounds: vi.fn().mockReturnValue({
      getWest: () => -99,
      getSouth: () => 37.5,
      getEast: () => -97,
      getNorth: () => 39.5,
    }),
    getZoom: vi.fn().mockReturnValue(4),
    getPitch: vi.fn().mockReturnValue(0),
    getBearing: vi.fn().mockReturnValue(0),
    getProjection: vi.fn().mockReturnValue({ type: projectionType }),
    getCanvas: vi.fn().mockReturnValue({ style: {} }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn(),
    getSource: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    dragPan: { enable: vi.fn(), disable: vi.fn() },
    boxZoom: { enable: vi.fn(), disable: vi.fn() },
  };
}

describe("ViewStateControl", () => {
  let mockMap: any;

  beforeEach(() => {
    mockMap = createMockMap();
  });

  describe("header title", () => {
    it("defaults the header title to 'View State'", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const title = container.querySelector(".maplibre-gl-view-state-title");
      expect(title?.textContent).toBe("View State");
    });

    it("uses a custom title when provided", () => {
      const control = new ViewStateControl({ collapsed: false, title: "Info" });
      const container = control.onAdd(mockMap);
      const title = container.querySelector(".maplibre-gl-view-state-title");
      expect(title?.textContent).toBe("Info");
    });
  });

  describe("rows", () => {
    it("renders the projection row with a friendly label", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const labels = Array.from(
        container.querySelectorAll(".maplibre-gl-view-state-label"),
      ).map((el) => el.textContent);
      expect(labels).toContain("Projection");
      const projectionRow = Array.from(
        container.querySelectorAll(".maplibre-gl-view-state-row"),
      ).find((row) =>
        row
          .querySelector(".maplibre-gl-view-state-label")
          ?.textContent?.includes("Projection"),
      );
      expect(
        projectionRow?.querySelector(".maplibre-gl-view-state-value")
          ?.textContent,
      ).toBe("Globe");
    });

    it("renders the bounds row last", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const labels = Array.from(
        container.querySelectorAll(".maplibre-gl-view-state-label"),
      ).map((el) => el.textContent);
      expect(labels[labels.length - 1]).toBe("Bounds");
      // Camera fields come before the extent.
      expect(labels.indexOf("Zoom")).toBeLessThan(labels.indexOf("Bounds"));
    });

    it("can hide the projection row", () => {
      const control = new ViewStateControl({
        collapsed: false,
        showProjection: false,
      });
      const container = control.onAdd(mockMap);
      const labels = Array.from(
        container.querySelectorAll(".maplibre-gl-view-state-label"),
      ).map((el) => el.textContent);
      expect(labels).not.toContain("Projection");
    });
  });

  describe("copy view button", () => {
    it("shows the unified copy-view button by default", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const copyBtn = container.querySelector('[aria-label="Copy view"]');
      expect(copyBtn).not.toBeNull();
    });

    it("copies the full camera state as one string", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const copyBtn = container.querySelector(
        '[aria-label="Copy view"]',
      ) as HTMLButtonElement;
      copyBtn.click();

      expect(writeText).toHaveBeenCalledTimes(1);
      const copied = writeText.mock.calls[0][0] as string;
      expect(copied).toContain("center:");
      expect(copied).toContain("zoom:");
      expect(copied).toContain("bearing:");
      expect(copied).toContain("pitch:");
    });

    it("can hide the copy-view button", () => {
      const control = new ViewStateControl({
        collapsed: false,
        showCopyView: false,
      });
      const container = control.onAdd(mockMap);
      expect(
        container.querySelector('[aria-label="Copy view"]'),
      ).toBeNull();
    });
  });

  describe("collapse to icon", () => {
    it("hides the toggle button while expanded and restores it on collapse", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const button = container.querySelector(
        ".maplibre-gl-view-state-button",
      ) as HTMLButtonElement;

      expect(
        container.classList.contains("maplibre-gl-view-state--expanded"),
      ).toBe(true);
      expect(button.style.visibility).toBe("hidden");

      control.collapse();
      expect(
        container.classList.contains("maplibre-gl-view-state--expanded"),
      ).toBe(false);
      expect(button.style.visibility).toBe("");
    });

    it("collapses via the inline header control", () => {
      const control = new ViewStateControl({ collapsed: false });
      const container = control.onAdd(mockMap);
      const collapseBtn = container.querySelector(
        '[aria-label="Collapse"]',
      ) as HTMLButtonElement;
      expect(collapseBtn).not.toBeNull();

      collapseBtn.click();
      expect(control.isCollapsed()).toBe(true);
    });
  });
});
