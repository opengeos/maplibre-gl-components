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

function finish(
  ctx: ReturnType<typeof createMapMock>,
  lng: number,
  lat: number,
) {
  ctx.fire("contextmenu", { preventDefault: vi.fn(), lngLat: { lng, lat } });
}

function mountExpanded(
  options?: ConstructorParameters<typeof MeasureControl>[0],
): {
  control: MeasureControl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any;
  container: HTMLElement;
} {
  const ctx = createMapMock();
  const control = new MeasureControl({ collapsed: false, ...options });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const container = control.onAdd(ctx.map as any);
  return { control, ctx, container };
}

/** The "Total Distance"/"Total Area" readout, as the user sees it. */
function readTotal(container: HTMLElement): string {
  const value = container.querySelector(".result-value")?.textContent ?? "";
  const unit = container.querySelector(".result-unit")?.textContent ?? "";
  return `${value} ${unit}`;
}

/** The numeric part of the total readout. */
function totalNumber(container: HTMLElement): number {
  return Number.parseFloat(
    container.querySelector(".result-value")?.textContent ?? "",
  );
}

/** The saved-measurements list entries, as the user sees them. */
function readList(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".measurement-value")].map(
    (el) => el.textContent ?? "",
  );
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
    ctx.fire("dblclick", {
      preventDefault: vi.fn(),
      lngLat: { lng: 2, lat: 0 },
    });

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
    ctx.fire("dblclick", {
      preventDefault: vi.fn(),
      lngLat: { lng: 0, lat: 0 },
    });
    expect(control.getMeasurements()).toHaveLength(0);
    expect(control.getState().isDrawing).toBe(true);
  });

  it("re-arms for the next measurement after finishing one", () => {
    const { control, ctx } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 1);
    ctx.fire("dblclick", {
      preventDefault: vi.fn(),
      lngLat: { lng: 1, lat: 1 },
    });
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

  it("keeps the total on screen after a measurement finishes", () => {
    const { ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    const whileDrawing = readTotal(container);
    finish(ctx, 1, 0);

    // Re-arming the tool resets the in-progress value, but the readout is
    // labelled "Total Distance" and must still report the finished measurement.
    expect(readTotal(container)).toBe(whileDrawing);
    expect(readTotal(container)).not.toMatch(/^0\.00 /);
    expect(readList(container)).toEqual([whileDrawing]);
  });

  it("sums completed measurements of the active mode", () => {
    const { ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    const one = totalNumber(container);

    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    // The readout rounds to two decimals, so compare with that slack.
    expect(totalNumber(container)).toBeCloseTo(one * 2, 1);

    // A third, in-progress measurement adds to the running total.
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    expect(totalNumber(container)).toBeCloseTo(one * 3, 1);
  });

  it("excludes measurements taken in the other mode from the total", () => {
    const { control, ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    expect(totalNumber(container)).toBeGreaterThan(0);

    control.setMode("area");
    expect(totalNumber(container)).toBe(0);

    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    clickAt(ctx, 1, 1);
    finish(ctx, 1, 1);
    const areaTotal = totalNumber(container);
    expect(areaTotal).toBeGreaterThan(0);

    control.setMode("distance");
    expect(totalNumber(container)).not.toBe(areaTotal);
    expect(totalNumber(container)).toBeGreaterThan(0);
  });

  it("drops a deleted measurement from the total", () => {
    const { ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    const one = totalNumber(container);

    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    expect(totalNumber(container)).toBeCloseTo(one * 2, 1);

    const deleteBtn = container.querySelector(
      ".measurement-delete",
    ) as HTMLButtonElement;
    deleteBtn.click();
    expect(totalNumber(container)).toBeCloseTo(one, 1);
  });

  it("re-renders the total and the saved list when the unit selector changes", () => {
    const { ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    finish(ctx, 1, 0);
    const kilometers = totalNumber(container);

    const select = container.querySelector(
      ".measure-unit select",
    ) as HTMLSelectElement;
    select.value = "meters";
    select.dispatchEvent(new Event("change"));

    expect(totalNumber(container) / kilometers).toBeCloseTo(1000, 0);
    expect(readTotal(container)).toMatch(/Meters$/);
    // The saved list must follow the selector too, not keep the old unit.
    expect(readList(container)).toEqual([readTotal(container)]);
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
