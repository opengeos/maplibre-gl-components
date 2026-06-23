import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeasureControl } from "../src/lib/core/MeasureControl";

// Vertex markers are rendered through an async `import("maplibre-gl")` that
// pulls in the real Marker implementation, which a lightweight map stub cannot
// satisfy. These tests cover measurement logic, not marker rendering, so stub
// the private helper to keep the dynamic import out of the way.
beforeEach(() => {
  vi.spyOn(
    MeasureControl.prototype as unknown as { _addMarker: () => void },
    "_addMarker",
  ).mockImplementation(() => {});
});

/**
 * Build a lightweight MapLibre map stub that records the event handlers the
 * control registers so tests can fire map interactions manually.
 */
function createMapMock() {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  let sourceData: GeoJSON.FeatureCollection | null = null;
  const source = {
    setData: vi.fn((d: GeoJSON.FeatureCollection) => {
      sourceData = d;
    }),
  };
  const map = {
    on: vi.fn((ev: string, fn: (...args: unknown[]) => void) => {
      (handlers[ev] ||= []).push(fn);
    }),
    off: vi.fn((ev: string, fn: (...args: unknown[]) => void) => {
      handlers[ev] = (handlers[ev] || []).filter((h) => h !== fn);
    }),
    once: vi.fn(),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn().mockReturnValue(source),
    getLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getZoom: vi.fn().mockReturnValue(5),
    getCanvas: vi.fn().mockReturnValue({ style: {} as CSSStyleDeclaration }),
    // Identity-ish projection so duplicate-vertex detection can run.
    project: vi.fn((lngLat: [number, number]) => ({
      x: lngLat[0] * 100,
      y: lngLat[1] * 100,
    })),
  };
  return {
    map,
    fire(ev: string, payload: unknown) {
      (handlers[ev] || []).forEach((h) => h(payload));
    },
    handlerCount(ev: string) {
      return (handlers[ev] || []).length;
    },
    get data() {
      return sourceData;
    },
  };
}

function clickAt(
  ctx: ReturnType<typeof createMapMock>,
  lng: number,
  lat: number,
) {
  ctx.fire("click", { lngLat: { lng, lat } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mountExpanded(): { control: MeasureControl; ctx: any } {
  const ctx = createMapMock();
  const control = new MeasureControl({ collapsed: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control.onAdd(ctx.map as any);
  return { control, ctx };
}

describe("MeasureControl", () => {
  it("starts drawing as soon as the panel opens (no separate Start click)", () => {
    const { control, ctx } = mountExpanded();
    expect(control.getState().isDrawing).toBe(true);
    expect(ctx.handlerCount("click")).toBe(1);
  });

  it("treats a double-click finish as an open polyline in distance mode", () => {
    const { control, ctx } = mountExpanded();

    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    // A double-click fires two clicks at the same spot before the dblclick.
    clickAt(ctx, 2, 0);
    clickAt(ctx, 2, 0);
    ctx.fire("dblclick", { preventDefault: vi.fn(), lngLat: { lng: 2, lat: 0 } });

    const measurements = control.getMeasurements();
    expect(measurements).toHaveLength(1);
    expect(measurements[0].mode).toBe("distance");
    // The duplicated final vertex from the double-click is dropped.
    expect(measurements[0].points).toHaveLength(3);

    const types = (ctx.data?.features ?? []).map((f) => f.geometry.type);
    expect(types).toContain("LineString");
    expect(types).not.toContain("Polygon");
  });

  it("ignores a premature finish and keeps the drawing active", () => {
    const { control, ctx } = mountExpanded();
    clickAt(ctx, 0, 0);
    ctx.fire("dblclick", { preventDefault: vi.fn(), lngLat: { lng: 0, lat: 0 } });
    expect(control.getMeasurements()).toHaveLength(0);
    expect(control.getState().isDrawing).toBe(true);
  });

  it("re-arms for the next measurement after finishing one", () => {
    const { control, ctx } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 1);
    ctx.fire("dblclick", { preventDefault: vi.fn(), lngLat: { lng: 1, lat: 1 } });
    expect(control.getMeasurements()).toHaveLength(1);
    expect(control.getState().isDrawing).toBe(true);
    expect(control.getState().currentPoints).toHaveLength(0);
  });

  it("finishes on right-click (contextmenu)", () => {
    const { control, ctx } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    ctx.fire("contextmenu", {
      preventDefault: vi.fn(),
      lngLat: { lng: 1, lat: 0 },
    });
    expect(control.getMeasurements()).toHaveLength(1);
    expect(control.getMeasurements()[0].mode).toBe("distance");
  });

  it("preserves in-progress points when switching mode mid-draw", () => {
    const { control, ctx } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    control.setMode("area");
    expect(control.getState().mode).toBe("area");
    expect(control.getState().currentPoints).toHaveLength(2);
    expect(control.getState().isDrawing).toBe(true);
  });
});
