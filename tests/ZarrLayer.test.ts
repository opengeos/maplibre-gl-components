import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZarrLayerControl } from "../src/lib/core/ZarrLayer";

/** Minimal mocked MapLibre map sufficient for ZarrLayerControl.onAdd. */
function makeMockMap() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    getZoom: vi.fn().mockReturnValue(4),
    isStyleLoaded: vi.fn().mockReturnValue(false),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn(),
    getSource: vi.fn(),
    triggerRepaint: vi.fn(),
  } as any;
}

/** A fake @carbonplan/zarr-layer with the live-update setters spied. */
function makeFakeLayer() {
  return {
    setColormap: vi.fn(),
    setClim: vi.fn(),
    setOpacity: vi.fn(),
  };
}

describe("ZarrLayerControl live restyle", () => {
  let control: any;
  let map: ReturnType<typeof makeMockMap>;
  let container: HTMLElement;
  let fake: ReturnType<typeof makeFakeLayer>;

  beforeEach(() => {
    control = new ZarrLayerControl({ collapsed: false });
    map = makeMockMap();
    container = control.onAdd(map);
    // Inject a live layer + its recorded props (as _addLayer would).
    fake = makeFakeLayer();
    control._zarrLayers.set("layer-1", fake);
    control._zarrLayerPropsMap.set("layer-1", {
      colormap: ["#000000"],
      clim: [0, 1],
    });
    map.triggerRepaint.mockClear();
  });

  it("applies a colormap change to the live layer and repaints", () => {
    const preview = container.querySelector("#zarr-colormap-preview");
    const select = preview?.parentElement?.querySelector(
      "select.maplibre-gl-zarr-layer-select"
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();

    // Pick a different colormap option and fire the change handler.
    const option = Array.from(select.options).find((o) => o.value !== "custom");
    select.value = option!.value;
    select.dispatchEvent(new Event("change"));

    expect(fake.setColormap).toHaveBeenCalledTimes(1);
    const applied = fake.setColormap.mock.calls[0][0];
    expect(Array.isArray(applied)).toBe(true);
    // The per-layer props are updated so persistence/popups stay in sync.
    expect(control._zarrLayerPropsMap.get("layer-1").colormap).toBe(applied);
    expect(map.triggerRepaint).toHaveBeenCalled();
  });

  it("applies a clim change to the live layer and repaints", () => {
    const numberInputs = container.querySelectorAll(
      'input.maplibre-gl-zarr-layer-input[type="number"]'
    );
    const [minInput, maxInput] = Array.from(
      numberInputs
    ) as HTMLInputElement[];
    expect(minInput).toBeTruthy();
    expect(maxInput).toBeTruthy();

    minInput.value = "5";
    minInput.dispatchEvent(new Event("input"));
    maxInput.value = "42";
    maxInput.dispatchEvent(new Event("input"));

    expect(fake.setClim).toHaveBeenLastCalledWith([5, 42]);
    expect(control._zarrLayerPropsMap.get("layer-1").clim).toEqual([5, 42]);
    expect(map.triggerRepaint).toHaveBeenCalled();
  });

  it("preserves a clim max of 0 instead of coercing it to 1", () => {
    const maxInput = container.querySelectorAll(
      'input.maplibre-gl-zarr-layer-input[type="number"]'
    )[1] as HTMLInputElement;
    maxInput.value = "0";
    maxInput.dispatchEvent(new Event("input"));
    const lastClim = fake.setClim.mock.calls.at(-1)?.[0];
    expect(lastClim?.[1]).toBe(0);
  });

  it("_updateColormap/_updateClim are safe no-ops with no layers", () => {
    control._zarrLayers.clear();
    expect(() => control._updateColormap()).not.toThrow();
    expect(() => control._updateClim()).not.toThrow();
  });
});
