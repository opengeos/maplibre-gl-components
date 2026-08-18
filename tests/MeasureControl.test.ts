import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EARTH_RADIUS_METERS,
  MeasureControl,
} from "../src/lib/core/MeasureControl";

/** Mars' mean radius, the stand-in for "some other body" in these tests. */
const MARS_RADIUS_METERS = 3389500;

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

/** Inline display of the total readout container. */
function resultDisplay(container: HTMLElement): string {
  return (container.querySelector(".measure-result") as HTMLElement).style
    .display;
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

  it("keeps a saved zero-value measurement's readout visible after Escape", () => {
    const { control, ctx, container } = mountExpanded();
    // Two coincident clicks finished with right-click save a measurement whose
    // distance is legitimately zero.
    clickAt(ctx, 0, 0);
    clickAt(ctx, 0, 0);
    finish(ctx, 0, 0);
    expect(control.getMeasurements()).toHaveLength(1);
    expect(totalNumber(container)).toBe(0);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(resultDisplay(container)).toBe("block");
  });

  it("hides the readout when Escape leaves nothing measured", () => {
    const { ctx, container } = mountExpanded();
    clickAt(ctx, 0, 0);
    clickAt(ctx, 1, 0);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(resultDisplay(container)).toBe("none");
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

  describe("radius", () => {
    it("defaults to Earth's mean radius", () => {
      const { control } = mountExpanded();
      expect(control.getRadius()).toBe(EARTH_RADIUS_METERS);
    });

    it("scales distances by the configured body radius", () => {
      const earth = mountExpanded();
      clickAt(earth.ctx, 0, 0);
      clickAt(earth.ctx, 1, 0);
      finish(earth.ctx, 1, 0);

      const mars = mountExpanded({ radius: MARS_RADIUS_METERS });
      clickAt(mars.ctx, 0, 0);
      clickAt(mars.ctx, 1, 0);
      finish(mars.ctx, 1, 0);

      const ratio = MARS_RADIUS_METERS / EARTH_RADIUS_METERS;
      expect(mars.control.getMeasurements()[0].distance!).toBeCloseTo(
        earth.control.getMeasurements()[0].distance! * ratio,
        6,
      );
    });

    it("scales areas by the square of the body radius ratio", () => {
      const earth = mountExpanded({ defaultMode: "area" });
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ].forEach(([lng, lat]) => clickAt(earth.ctx, lng, lat));
      finish(earth.ctx, 1, 1);

      const mars = mountExpanded({
        defaultMode: "area",
        radius: MARS_RADIUS_METERS,
      });
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ].forEach(([lng, lat]) => clickAt(mars.ctx, lng, lat));
      finish(mars.ctx, 1, 1);

      const ratio = MARS_RADIUS_METERS / EARTH_RADIUS_METERS;
      expect(mars.control.getMeasurements()[0].area!).toBeCloseTo(
        earth.control.getMeasurements()[0].area! * ratio * ratio,
        6,
      );
    });

    it("recomputes saved measurements and the readout when the radius changes", () => {
      const { control, ctx, container } = mountExpanded();
      clickAt(ctx, 0, 0);
      clickAt(ctx, 1, 0);
      finish(ctx, 1, 0);

      const earthDistance = control.getMeasurements()[0].distance!;
      const earthTotal = totalNumber(container);

      control.setRadius(MARS_RADIUS_METERS);

      const ratio = MARS_RADIUS_METERS / EARTH_RADIUS_METERS;
      const measurement = control.getMeasurements()[0];
      expect(measurement.distance!).toBeCloseTo(earthDistance * ratio, 6);
      expect(measurement.segments![0]).toBeCloseTo(earthDistance * ratio, 6);
      // The panel follows, rather than keeping the Earth numbers on screen.
      expect(totalNumber(container)).toBeCloseTo(earthTotal * ratio, 2);
      expect(readList(container)).toEqual([readTotal(container)]);
    });

    it("emits radiuschange so hosts can refresh derived readouts", () => {
      const { control } = mountExpanded();
      const seen: string[] = [];
      control.on("radiuschange", (event) => seen.push(event.type));

      control.setRadius(MARS_RADIUS_METERS);
      expect(seen).toEqual(["radiuschange"]);

      // Setting the same radius again is a no-op, not a second event.
      control.setRadius(MARS_RADIUS_METERS);
      expect(seen).toEqual(["radiuschange"]);
    });

    it("ignores a non-positive or non-finite radius", () => {
      const { control } = mountExpanded();
      control.setRadius(0);
      control.setRadius(-1);
      control.setRadius(Number.NaN);
      control.setRadius(Number.POSITIVE_INFINITY);
      expect(control.getRadius()).toBe(EARTH_RADIUS_METERS);
    });

    it("falls back to Earth for an unusable radius option", () => {
      for (const radius of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const { control } = mountExpanded({ radius });
        expect(control.getRadius()).toBe(EARTH_RADIUS_METERS);
      }
    });

    it("measures against a valid radius option rather than discarding it", () => {
      const { control } = mountExpanded({ radius: MARS_RADIUS_METERS });
      expect(control.getRadius()).toBe(MARS_RADIUS_METERS);
    });
  });
});
