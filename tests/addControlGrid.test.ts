import { describe, it, expect, vi } from "vitest";
import {
  addControlGrid,
  ALL_DEFAULT_CONTROLS,
  DEFAULT_EXCLUDE_LAYERS,
} from "../src/lib/addControlGrid";
import { ControlGrid } from "../src/lib/core/ControlGrid";

// Minimal mock map that satisfies addControl and ControlGrid.onAdd
function createMockMap() {
  const map = {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    hasControl: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    getZoom: vi.fn().mockReturnValue(4),
    getCenter: vi.fn().mockReturnValue({ lng: -98, lat: 38.5 }),
    getBearing: vi.fn().mockReturnValue(0),
    getPitch: vi.fn().mockReturnValue(0),
    isStyleLoaded: vi.fn().mockReturnValue(false),
    getBounds: vi.fn().mockReturnValue({
      getSouthWest: () => ({ lng: -99, lat: 37.5 }),
      getNorthEast: () => ({ lng: -97, lat: 39.5 }),
      getNorthWest: () => ({ lng: -99, lat: 39.5 }),
      getSouthEast: () => ({ lng: -97, lat: 37.5 }),
      getWest: () => -99,
      getEast: () => -97,
      getSouth: () => 37.5,
      getNorth: () => 39.5,
    }),
    getCanvas: vi.fn().mockReturnValue({
      style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    }),
    getContainer: vi.fn().mockReturnValue(document.createElement("div")),
    getCanvasContainer: vi.fn().mockReturnValue(document.createElement("div")),
    getStyle: vi.fn().mockReturnValue({ layers: [] }),
    queryRenderedFeatures: vi.fn().mockReturnValue([]),
    jumpTo: vi.fn(),
    flyTo: vi.fn(),
    setCenter: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    getLayer: vi.fn(),
    unproject: vi.fn().mockReturnValue({ lng: 0, lat: 0 }),
    _canvas: {
      style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  } as any;

  // addControl calls onAdd like the real MapLibre does
  map.addControl.mockImplementation(function (ctrl: any, _pos?: string) {
    if (ctrl.onAdd) {
      ctrl.onAdd(map);
    }
  });

  return map;
}

describe("addControlGrid", () => {
  it("should return a ControlGrid instance", () => {
    const map = createMockMap();
    const grid = addControlGrid(map);
    expect(grid).toBeInstanceOf(ControlGrid);
  });

  it("should call map.addControl", () => {
    const map = createMockMap();
    addControlGrid(map);
    expect(map.addControl).toHaveBeenCalledTimes(1);
  });

  it("should use all default controls when no options provided", () => {
    const map = createMockMap();
    const grid = addControlGrid(map);
    const controls = grid.getControls();
    expect(controls.length).toBe(ALL_DEFAULT_CONTROLS.length);
  });

  it("should exclude controls via the exclude option", () => {
    const map = createMockMap();
    const grid = addControlGrid(map, {
      exclude: ["minimap", "streetView", "gaussianSplat"],
    });
    const controls = grid.getControls();
    expect(controls.length).toBe(ALL_DEFAULT_CONTROLS.length - 3);
  });

  it("should use explicit defaultControls when provided", () => {
    const map = createMockMap();
    const grid = addControlGrid(map, {
      defaultControls: ["search", "basemap", "terrain"],
    });
    const controls = grid.getControls();
    expect(controls.length).toBe(3);
  });

  it("should ignore exclude when defaultControls is provided", () => {
    const map = createMockMap();
    const grid = addControlGrid(map, {
      defaultControls: ["search", "basemap"],
      exclude: ["search"],
    });
    const controls = grid.getControls();
    expect(controls.length).toBe(2);
  });

  it("should auto-calculate grid dimensions for all defaults", () => {
    const map = createMockMap();
    const grid = addControlGrid(map);
    const state = grid.getState();
    const cols = Math.ceil(Math.sqrt(ALL_DEFAULT_CONTROLS.length));
    const rows = Math.ceil(ALL_DEFAULT_CONTROLS.length / cols);
    expect(state.columns).toBe(cols);
    expect(state.rows).toBeGreaterThanOrEqual(rows);
  });

  it("should auto-calculate rows when only columns provided", () => {
    const map = createMockMap();
    const grid = addControlGrid(map, {
      defaultControls: ["search", "basemap", "terrain", "fullscreen"],
      columns: 2,
    });
    const state = grid.getState();
    expect(state.columns).toBe(2);
    expect(state.rows).toBeGreaterThanOrEqual(2);
  });

  it("should auto-calculate columns when only rows provided", () => {
    const map = createMockMap();
    const grid = addControlGrid(map, {
      defaultControls: ["search", "basemap", "terrain", "fullscreen"],
      rows: 2,
    });
    const state = grid.getState();
    expect(state.rows).toBeGreaterThanOrEqual(2);
    expect(state.columns).toBe(2);
  });

  it("should set default excludeLayers", () => {
    // Verify the constant contains the expected patterns
    expect(DEFAULT_EXCLUDE_LAYERS).toContain("measure-*");
    expect(DEFAULT_EXCLUDE_LAYERS).toContain("inspect-highlight-*");
    expect(DEFAULT_EXCLUDE_LAYERS).toContain("lidar-*");
    expect(DEFAULT_EXCLUDE_LAYERS.length).toBe(7);
  });

  it("should default to top-right position", () => {
    const map = createMockMap();
    addControlGrid(map);
    expect(map.addControl).toHaveBeenCalledWith(
      expect.any(ControlGrid),
      "top-right",
    );
  });

  it("should respect custom position", () => {
    const map = createMockMap();
    addControlGrid(map, { position: "bottom-left" });
    expect(map.addControl).toHaveBeenCalledWith(
      expect.any(ControlGrid),
      "bottom-left",
    );
  });

  it("should pass basemapStyleUrl through to ControlGrid", () => {
    const map = createMockMap();
    const url = "https://example.com/style.json";
    const grid = addControlGrid(map, { basemapStyleUrl: url });
    expect(grid).toBeInstanceOf(ControlGrid);
  });
});

describe("ALL_DEFAULT_CONTROLS", () => {
  it("should contain 29 control names", () => {
    expect(ALL_DEFAULT_CONTROLS.length).toBe(29);
  });

  it("should contain all expected controls", () => {
    const expected = [
      "fullscreen",
      "globe",
      "north",
      "terrain",
      "search",
      "viewState",
      "inspect",
      "vectorDataset",
      "basemap",
      "cogLayer",
      "minimap",
      "measure",
      "bookmark",
      "print",
      "zarrLayer",
      "pmtilesLayer",
      "stacLayer",
      "stacSearch",
      "addVector",
      "geoEditor",
      "lidar",
      "planetaryComputer",
      "gaussianSplat",
      "streetView",
      "swipe",
      "usgsLidar",
      "colorbarGui",
      "legendGui",
      "htmlGui",
    ];
    for (const name of expected) {
      expect(ALL_DEFAULT_CONTROLS).toContain(name);
    }
  });
});
