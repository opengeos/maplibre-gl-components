import { describe, it, expect } from "vitest";
import { resolvePMTilesViewTarget } from "../src/lib/core/PMTilesLayer";

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
});
