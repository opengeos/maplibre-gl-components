import { describe, it, expect, vi } from "vitest";
import {
  PMTilesLayerControl,
  pmtilesSourceLayerId,
  resolvePMTilesViewTarget,
} from "../src/lib/core/PMTilesLayer";
import type { PMTilesLayerInfo } from "../src/lib/core/types";

describe("resolvePMTilesViewTarget", () => {
  it("prefers bounds over a null-island center for a global archive", () => {
    // Overture Maps exports leave the optional center field at 0,0,0 even
    // though the archive spans the whole world. Flying to that center would
    // drop the map on "null island" in the Gulf of Guinea.
    const target = resolvePMTilesViewTarget({
      minLon: -180,
      minLat: -85.0511287,
      maxLon: 180,
      maxLat: 85.0511287,
      centerLon: 0,
      centerLat: 0,
      maxZoom: 14,
    });

    expect(target).toEqual({
      type: "bounds",
      bounds: [
        [-180, -85.0511287],
        [180, 85.0511287],
      ],
    });
  });

  it("fits the bounds of a regional archive", () => {
    const target = resolvePMTilesViewTarget({
      minLon: -122.5,
      minLat: 37.7,
      maxLon: -122.3,
      maxLat: 37.9,
      centerLon: -122.4,
      centerLat: 37.8,
      maxZoom: 16,
    });

    expect(target).toEqual({
      type: "bounds",
      bounds: [
        [-122.5, 37.7],
        [-122.3, 37.9],
      ],
    });
  });

  it("falls back to the center when bounds are degenerate", () => {
    const target = resolvePMTilesViewTarget({
      minLon: 5,
      minLat: 5,
      maxLon: 5,
      maxLat: 5,
      centerLon: 5,
      centerLat: 5,
      maxZoom: 12,
    });

    expect(target).toEqual({
      type: "center",
      center: [5, 5],
      zoom: 10, // min(maxZoom - 2, 14)
    });
  });

  it("clamps the fallback center zoom to 14", () => {
    const target = resolvePMTilesViewTarget({
      minLon: 5,
      minLat: 5,
      maxLon: 5,
      maxLat: 5,
      centerLon: 5,
      centerLat: 5,
      maxZoom: 24,
    });

    expect(target).toEqual({ type: "center", center: [5, 5], zoom: 14 });
  });

  it("returns null when neither bounds nor center are usable", () => {
    const target = resolvePMTilesViewTarget({
      minLon: 0,
      minLat: 0,
      maxLon: 0,
      maxLat: 0,
      centerLon: undefined,
      centerLat: undefined,
      maxZoom: 10,
    });

    expect(target).toBeNull();
  });

  it("ignores non-finite bounds and falls back to the center", () => {
    const target = resolvePMTilesViewTarget({
      minLon: Number.NaN,
      minLat: -10,
      maxLon: 10,
      maxLat: 10,
      centerLon: 2,
      centerLat: 3,
      maxZoom: 9,
    });

    expect(target).toEqual({ type: "center", center: [2, 3], zoom: 7 });
  });

  it("clamps the fallback center zoom to a non-negative value", () => {
    // Archives with a very low maxZoom must not yield a negative flyTo zoom.
    for (const maxZoom of [0, 1]) {
      expect(
        resolvePMTilesViewTarget({
          minLon: 5,
          minLat: 5,
          maxLon: 5,
          maxLat: 5,
          centerLon: 10,
          centerLat: 10,
          maxZoom,
        }),
      ).toEqual({ type: "center", center: [10, 10], zoom: 0 });
    }
  });
});

describe("pmtilesSourceLayerId", () => {
  it("names a source layer's map layer from the raw source-layer name", () => {
    expect(pmtilesSourceLayerId("pmtiles-source-0", "roads", "line")).toBe(
      "pmtiles-source-0-roads-line",
    );
    // Not encoded: a name with a slash or a space is used as is.
    expect(pmtilesSourceLayerId("s", "a/b c", "fill")).toBe("s-a/b c-fill");
  });
});

describe("PMTilesLayerControl source removal", () => {
  /** A map stub whose style holds the given layers on the given sources. */
  function mapWithLayers(layers: Array<{ id: string; source: string }>) {
    const style = { layers: [...layers] };
    const sources = new Set(layers.map((layer) => layer.source));
    return {
      style,
      sources,
      getLayer: (id: string) => style.layers.find((layer) => layer.id === id),
      removeLayer: vi.fn((id: string) => {
        style.layers = style.layers.filter((layer) => layer.id !== id);
      }),
      getSource: (id: string) => (sources.has(id) ? {} : undefined),
      getStyle: () => style,
      removeSource: vi.fn((id: string) => {
        if (style.layers.some((layer) => layer.source === id)) {
          throw new Error(`Source "${id}" cannot be removed while in use`);
        }
        sources.delete(id);
      }),
    };
  }

  function controlWith(map: ReturnType<typeof mapWithLayers>) {
    const control = new PMTilesLayerControl();
    const internals = control as unknown as {
      _map: unknown;
      _pmtilesLayers: Map<string, PMTilesLayerInfo>;
      _render: () => void;
    };
    internals._map = map;
    internals._render = () => {};
    internals._pmtilesLayers.set("src", {
      id: "src",
      url: "https://example.com/a.pmtiles",
      tileType: "vector",
      sourceLayers: ["roads"],
      layerIds: ["src-roads-line"],
      opacity: 1,
      pickable: false,
    });
    return control;
  }

  it("removes a host layer still reading the source, then the source", () => {
    const map = mapWithLayers([
      { id: "src-roads-line", source: "src" },
      { id: "host-arrows", source: "src" },
      { id: "other", source: "elsewhere" },
    ]);
    controlWith(map).removeLayer("src");
    expect(map.style.layers.map((layer) => layer.id)).toEqual(["other"]);
    expect(map.sources.has("src")).toBe(false);
    expect(map.sources.has("elsewhere")).toBe(true);
  });

  it("does the same when every archive is removed", () => {
    const map = mapWithLayers([
      { id: "src-roads-line", source: "src" },
      { id: "host-arrows", source: "src" },
    ]);
    controlWith(map).removeLayer();
    expect(map.style.layers).toEqual([]);
    expect(map.sources.has("src")).toBe(false);
  });
});
