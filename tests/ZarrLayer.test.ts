import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pickDataVariables,
  ZarrLayerControl,
  zarrSpatialMetadataFromAttributes,
  zarrSpatialMetadataFromV2Consolidated,
  zarrSpatialMetadataFromV3Root,
} from "../src/lib/core/ZarrLayer";

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
    setSelector: vi.fn().mockResolvedValue(undefined),
  };
}

/** The panel's Selector (JSON) field. */
function selectorInputOf(container: HTMLElement): HTMLInputElement {
  const input = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input.maplibre-gl-zarr-layer-input[type="text"]',
    ),
  ).find((el) => el.placeholder.includes('"band"'));
  expect(input).toBeTruthy();
  return input!;
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
      "select.maplibre-gl-zarr-layer-select",
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
      'input.maplibre-gl-zarr-layer-input[type="number"]',
    );
    const [minInput, maxInput] = Array.from(numberInputs) as HTMLInputElement[];
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
      'input.maplibre-gl-zarr-layer-input[type="number"]',
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

  it("re-slices the live layer when the selector is edited", async () => {
    vi.useFakeTimers();
    try {
      const input = selectorInputOf(container);
      input.value = '{"band":"prec","month":12}';
      input.dispatchEvent(new Event("input"));

      // Debounced: nothing reaches the renderer until the typing settles.
      expect(fake.setSelector).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();

      expect(fake.setSelector).toHaveBeenCalledTimes(1);
      expect(fake.setSelector).toHaveBeenCalledWith({
        band: "prec",
        month: 12,
      });
      expect(control._zarrLayerPropsMap.get("layer-1").selector).toEqual({
        band: "prec",
        month: 12,
      });
      expect(map.triggerRepaint).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("collapses a burst of edits onto the latest selector", async () => {
    vi.useFakeTimers();
    try {
      const input = selectorInputOf(container);
      // Typing "12" one digit at a time passes through a valid `month: 1`.
      input.value = '{"month":1}';
      input.dispatchEvent(new Event("input"));
      input.value = '{"month":12}';
      input.dispatchEvent(new Event("input"));
      await vi.runAllTimersAsync();

      expect(fake.setSelector).toHaveBeenCalledTimes(1);
      expect(fake.setSelector).toHaveBeenCalledWith({ month: 12 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores an incomplete selector and keeps the last valid one", async () => {
    vi.useFakeTimers();
    try {
      const input = selectorInputOf(container);
      input.value = '{"month":3}';
      input.dispatchEvent(new Event("input"));
      await vi.runAllTimersAsync();
      expect(fake.setSelector).toHaveBeenCalledWith({ month: 3 });

      fake.setSelector.mockClear();
      input.value = '{"month":';
      input.dispatchEvent(new Event("input"));
      await vi.runAllTimersAsync();
      expect(fake.setSelector).not.toHaveBeenCalled();
      expect(control._state.selector).toEqual({ month: 3 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the layer on its slice when setSelector rejects", async () => {
    vi.useFakeTimers();
    try {
      control._zarrLayerPropsMap.get("layer-1").selector = { month: 1 };
      fake.setSelector.mockRejectedValueOnce(new Error("no such dimension"));
      const input = selectorInputOf(container);
      input.value = '{"nope":9}';
      input.dispatchEvent(new Event("input"));
      await vi.runAllTimersAsync();

      expect(fake.setSelector).toHaveBeenCalledTimes(1);
      expect(control._zarrLayerPropsMap.get("layer-1").selector).toEqual({
        month: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("_updateSelector is a safe no-op with no layers", () => {
    control._zarrLayers.clear();
    expect(() => control._updateSelector()).not.toThrow();
  });
});

describe("ZarrLayerControl CRS panel fields", () => {
  it("renders CRS and proj4 inputs that update the control state", () => {
    // A projected store (a national grid, a polar stereographic grid) is read as
    // WGS84 without a CRS, so it renders in the wrong place. The panel has to
    // offer somewhere to put one.
    const control = new ZarrLayerControl({ collapsed: false }) as any;
    const container = control.onAdd(makeMockMap());

    const crsInput = container.querySelector(
      '#zarr-crs, input[placeholder*="EPSG:4326"]',
    ) as HTMLInputElement;
    const proj4Input = container.querySelector(
      'input[placeholder^="+proj="]',
    ) as HTMLInputElement;

    expect(crsInput).toBeTruthy();
    expect(proj4Input).toBeTruthy();

    crsInput.value = "EPSG:3857";
    crsInput.dispatchEvent(new Event("input"));
    proj4Input.value = "+proj=stere +lat_0=-90 +units=m +no_defs";
    proj4Input.dispatchEvent(new Event("input"));

    expect(control.getState().crs).toBe("EPSG:3857");
    expect(control.getState().proj4).toBe(
      "+proj=stere +lat_0=-90 +units=m +no_defs",
    );
  });

  it("pre-fills the fields from the control options", () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      defaultCrs: "EPSG:4326",
      defaultProj4: "+proj=longlat +datum=WGS84 +no_defs",
    }) as any;
    control.onAdd(makeMockMap());

    expect(control.getState().crs).toBe("EPSG:4326");
    expect(control.getState().proj4).toBe(
      "+proj=longlat +datum=WGS84 +no_defs",
    );
  });
});

describe("pickDataVariables", () => {
  it("lists the data variables of a Zarr v3 consolidated store", () => {
    // The node names of zarr-layer's antarctic_era5 demo store: one data
    // variable plus the coordinate arrays that describe it.
    expect(
      pickDataVariables(["spatial_ref", "time", "wind_speed", "x", "y"]),
    ).toEqual(["wind_speed"]);
  });

  it("keeps the leaf name of a nested v2 path", () => {
    expect(pickDataVariables(["5/climate", "5/x", "5/y", "5/time"])).toEqual([
      "climate",
    ]);
  });

  it("deduplicates a variable that appears at several pyramid levels", () => {
    expect(pickDataVariables(["0/climate", "1/climate", "2/climate"])).toEqual([
      "climate",
    ]);
  });

  it("falls back to every name when only coordinate arrays are present", () => {
    // Better to offer something than to leave the user with an empty list.
    expect(pickDataVariables(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns nothing for a store with no arrays", () => {
    expect(pickDataVariables([])).toEqual([]);
  });
});

describe("zarrSpatialMetadataFromAttributes", () => {
  it("reads a proj4 definition and bounds", () => {
    expect(
      zarrSpatialMetadataFromAttributes({
        proj4: " +proj=stere +lat_0=-90 +units=m +no_defs ",
        bounds: [-3315363.2, -3316901.5, 3316909.4, 3315371.1],
      }),
    ).toEqual({
      proj4: "+proj=stere +lat_0=-90 +units=m +no_defs",
      bounds: [-3315363.2, -3316901.5, 3316909.4, 3315371.1],
    });
  });

  it("ignores bounds that are not four finite numbers", () => {
    expect(zarrSpatialMetadataFromAttributes({ bounds: [0, 1, 2] })).toEqual(
      {},
    );
    expect(
      zarrSpatialMetadataFromAttributes({ bounds: [0, 1, 2, "x"] }),
    ).toEqual({});
    expect(
      zarrSpatialMetadataFromAttributes({ bounds: [0, 1, 2, Number.NaN] }),
    ).toEqual({});
  });

  it("ignores crs_wkt, which the renderer cannot consume", () => {
    expect(
      zarrSpatialMetadataFromAttributes({ crs_wkt: 'PROJCS["unknown",...]' }),
    ).toEqual({});
  });

  it("tolerates a missing or non-object attributes block", () => {
    expect(zarrSpatialMetadataFromAttributes(undefined)).toEqual({});
    expect(zarrSpatialMetadataFromAttributes("nope")).toEqual({});
  });
});

describe("zarrSpatialMetadataFromV3Root", () => {
  it("reads the root group attributes of a v3 store", () => {
    const detected = zarrSpatialMetadataFromV3Root({
      zarr_format: 3,
      node_type: "group",
      attributes: {
        proj4:
          "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +datum=WGS84 +units=m +no_defs",
        bounds: [-3315363.2, -3316901.5, 3316909.4, 3315371.1],
      },
      consolidated_metadata: {
        metadata: { wind_speed: { node_type: "array" } },
      },
    });

    expect(detected.proj4).toContain("+proj=stere");
    expect(detected.bounds).toEqual([
      -3315363.2, -3316901.5, 3316909.4, 3315371.1,
    ]);
  });

  it("falls back to a CF-style spatial_ref coordinate", () => {
    const detected = zarrSpatialMetadataFromV3Root({
      attributes: {},
      consolidated_metadata: {
        metadata: {
          spatial_ref: {
            node_type: "array",
            attributes: {
              proj4: "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs",
            },
          },
        },
      },
    });

    expect(detected.proj4).toBe(
      "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs",
    );
  });

  it("prefers the root over spatial_ref when both declare a definition", () => {
    const detected = zarrSpatialMetadataFromV3Root({
      attributes: { proj4: "+proj=root" },
      consolidated_metadata: {
        metadata: { spatial_ref: { attributes: { proj4: "+proj=child" } } },
      },
    });

    expect(detected.proj4).toBe("+proj=root");
  });

  it("detects nothing for a WGS84 store that declares no reference", () => {
    // The pre-existing behavior for plain lat/lon stores must not change.
    expect(
      zarrSpatialMetadataFromV3Root({ attributes: {}, node_type: "group" }),
    ).toEqual({});
    expect(zarrSpatialMetadataFromV3Root(null)).toEqual({});
  });
});

describe("zarrSpatialMetadataFromV2Consolidated", () => {
  it("reads the root attributes under the .zattrs key", () => {
    const detected = zarrSpatialMetadataFromV2Consolidated({
      metadata: {
        ".zattrs": { crs: "EPSG:3857" },
        "climate/.zarray": { shape: [1] },
      },
    });

    expect(detected.crs).toBe("EPSG:3857");
  });

  it("falls back to spatial_ref/.zattrs", () => {
    const detected = zarrSpatialMetadataFromV2Consolidated({
      metadata: {
        ".zattrs": {},
        "spatial_ref/.zattrs": { proj4: "+proj=laea +lat_0=52 +lon_0=10" },
      },
    });

    expect(detected.proj4).toBe("+proj=laea +lat_0=52 +lon_0=10");
  });

  it("detects nothing from an empty or absent metadata block", () => {
    expect(zarrSpatialMetadataFromV2Consolidated({})).toEqual({});
    expect(zarrSpatialMetadataFromV2Consolidated(undefined)).toEqual({});
  });
});

describe("sample dataset settings", () => {
  /** Open the panel and click the sample entry at `index`. */
  function pickSample(control: ZarrLayerControl, index: number): void {
    const container = control.onAdd(makeMockMap());
    document.body.appendChild(container);
    (
      container.querySelector(".maplibre-gl-sample-trigger") as HTMLButtonElement
    ).click();
    const options = [
      ...container.querySelectorAll(".maplibre-gl-sample-option"),
    ] as HTMLButtonElement[];
    options[index].click();
  }

  it("applies the picked sample's variable, clim, colormap and selector", () => {
    // Without this the second sample inherits the first one's settings: a
    // sea-surface-temperature cube against a 0-300 ramp is a flat wash, and a
    // `{ band, month }` selector names dimensions it does not have.
    const control = new ZarrLayerControl({
      collapsed: false,
      defaultVariable: "climate",
      defaultClim: [0, 300],
      defaultSelector: { band: "prec", month: 1 },
      sampleData: [
        { label: "Climate", url: "https://example.com/climate.zarr" },
        {
          label: "Sea surface temperature",
          url: "https://example.com/sst.zarr",
          variable: "sst",
          clim: [-2, 32],
          colormap: ["#111111", "#eeeeee"],
          selector: {},
        },
      ],
    });

    pickSample(control, 1);

    const state = control.getState();
    expect(state.url).toBe("https://example.com/sst.zarr");
    expect(state.variable).toBe("sst");
    expect(state.clim).toEqual([-2, 32]);
    expect(state.colormap).toEqual(["#111111", "#eeeeee"]);
    // An empty selector clears the one the other sample needs.
    expect(state.selector).toBeUndefined();
  });

  it("leaves the control's own defaults alone for a URL-only sample", () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      defaultVariable: "climate",
      defaultClim: [0, 300],
      defaultSelector: { band: "prec", month: 1 },
      sampleData: [{ label: "Climate", url: "https://example.com/climate.zarr" }],
    });

    pickSample(control, 0);

    const state = control.getState();
    expect(state.url).toBe("https://example.com/climate.zarr");
    expect(state.variable).toBe("climate");
    expect(state.clim).toEqual([0, 300]);
    expect(state.selector).toEqual({ band: "prec", month: 1 });
  });
});


describe("spatial metadata detection", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  it("reads a custom store's own metadata instead of fetching its URL", async () => {
    // A store-backed layer's URL is only an identifier (a kerchunk manifest, a
    // marker for a folder on disk), so fetching it would log errors for
    // documents that were never there and detect nothing.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const control = new ZarrLayerControl() as any;
      const store = {
        get: vi.fn(async (key: string) =>
          key === ".zmetadata"
            ? encode({ metadata: { ".zattrs": { proj4: "+proj=stere +lat_0=90" } } })
            : undefined,
        ),
      };

      const detected = await control._detectSpatialMetadata("local-zarr:demo", store);

      expect(detected).toEqual({ proj4: "+proj=stere +lat_0=90" });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(store.get).toHaveBeenCalledWith("zarr.json");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("detects nothing, and still does not fetch, for a silent custom store", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const control = new ZarrLayerControl() as any;
      const detected = await control._detectSpatialMetadata("local-zarr:demo", {
        get: async () => undefined,
      });
      expect(detected).toEqual({});
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("still fetches for a plain URL store", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: any) =>
        ({
          ok: String(input).endsWith("/.zmetadata"),
          json: async () => ({ metadata: { ".zattrs": { crs: "EPSG:3857" } } }),
        }) as any,
    );
    try {
      const control = new ZarrLayerControl() as any;
      const detected = await control._detectSpatialMetadata("https://example.com/demo.zarr");
      expect(detected).toEqual({ crs: "EPSG:3857" });
      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/demo.zarr/zarr.json");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("reads a store with no URL at all", async () => {
    const control = new ZarrLayerControl() as any;
    const detected = await control._detectSpatialMetadata("", {
      get: async (key: string) =>
        key === "zarr.json"
          ? encode({ attributes: { crs: "EPSG:4326" } })
          : undefined,
    });
    expect(detected).toEqual({ crs: "EPSG:4326" });
  });
});

describe("local folder store", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  /** A folder-backed store holding one consolidated v2 dataset. */
  function makeLocalStore(name = "demo.zarr") {
    return {
      name,
      store: {
        get: vi.fn(async (key: string) =>
          key === ".zmetadata"
            ? encode({
                metadata: {
                  "air/.zarray": { shape: [3, 4, 5] },
                  "time/.zarray": { shape: [3] },
                },
              })
            : undefined,
        ),
      },
    };
  }

  it("shows no browse button when the host supplies no provider", () => {
    const control = new ZarrLayerControl({ collapsed: false }) as any;
    const container = control.onAdd(makeMockMap());
    const labels = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).map((button) => button.textContent);
    expect(labels).not.toContain("Browse folder...");
  });

  it("adopts a picked folder and shows its name", async () => {
    const picked = makeLocalStore();
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => picked,
    }) as any;
    const container = control.onAdd(makeMockMap());

    const browse = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent === "Browse folder...");
    expect(browse).toBeTruthy();

    await control._pickLocalStore();

    expect(control._localStore).toBe(picked);
    // The identifier is minted here: a folder has no address to record.
    expect(control._localStoreUrl).toMatch(/^local-zarr:demo\.zarr\?\d+$/);
    expect(control._state.url).toBe("");
    expect(
      control._container.querySelector(".maplibre-gl-zarr-layer-local-store-name")
        ?.textContent,
    ).toBe("demo.zarr");
  });

  it("keeps two folders of the same name apart", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => makeLocalStore(),
    }) as any;
    control.onAdd(makeMockMap());

    await control._pickLocalStore();
    const first = control._localStoreUrl;
    await control._pickLocalStore();

    expect(control._localStoreUrl).not.toBe(first);
  });

  it("honors a host-supplied identifier", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => ({ ...makeLocalStore(), url: "host:chosen" }),
    }) as any;
    control.onAdd(makeMockMap());

    await control._pickLocalStore();

    expect(control._localStoreUrl).toBe("host:chosen");
  });

  it("lists variables through the store rather than fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const picked = makeLocalStore();
      const control = new ZarrLayerControl({
        collapsed: false,
        localStoreProvider: async () => picked,
      }) as any;
      control.onAdd(makeMockMap());
      await control._pickLocalStore();

      const variables = await control.fetchVariables();

      expect(variables).toEqual(["air"]);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(picked.store.get).toHaveBeenCalledWith(".zmetadata");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("drops the picked folder once a URL is typed", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => makeLocalStore(),
    }) as any;
    const container = control.onAdd(makeMockMap());
    await control._pickLocalStore();
    expect(control._localStore).toBeTruthy();

    const urlInput = container.querySelector<HTMLInputElement>(
      'input.maplibre-gl-zarr-layer-input[placeholder^="https://"]',
    );
    urlInput!.value = "https://example.com/data.zarr";
    urlInput!.dispatchEvent(new Event("input"));

    expect(control._localStore).toBeNull();
    expect(control._localStoreUrl).toBe("");
    expect(control._state.url).toBe("https://example.com/data.zarr");
  });

  it("no longer demands a URL once a folder is picked", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => makeLocalStore(),
    }) as any;
    control.onAdd(makeMockMap());
    await control._pickLocalStore();
    control._state.variable = "";

    await control._addLayer();

    // The variable is still required; the URL is not.
    expect(control._state.error).toBe("Please enter a variable name.");
  });
});

describe("Fetch button availability", () => {
  it("is enabled by a picked folder even though the URL field is empty", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      localStoreProvider: async () => ({
        name: "demo.zarr",
        store: { get: async () => undefined },
      }),
    }) as any;
    const container = control.onAdd(makeMockMap());

    const fetchOf = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Fetch",
      );
    expect(fetchOf(container)?.disabled).toBe(true);

    await control._pickLocalStore();

    // The panel re-rendered, so re-query rather than reuse the stale node.
    expect(fetchOf(control._container).disabled).toBe(false);
  });
});

describe("fetched variable reconciliation", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  it("adopts the first fetched variable when the panel's is not in the store", async () => {
    // Otherwise the picker displays the first option while the state still holds
    // the previous store's variable, and Add Layer asks for one that is absent.
    const control = new ZarrLayerControl({
      collapsed: false,
      defaultVariable: "climate",
      localStoreProvider: async () => ({
        name: "demo.zarr",
        store: {
          get: async (key: string) =>
            key === ".zmetadata"
              ? encode({ metadata: { "air/.zarray": { shape: [3, 4, 5] } } })
              : undefined,
        },
      }),
    }) as any;
    control.onAdd(makeMockMap());
    await control._pickLocalStore();

    await control.fetchVariables();

    expect(control._availableVariables).toEqual(["air"]);
    expect(control._state.variable).toBe("air");
  });

  it("keeps a variable the store does have", async () => {
    const control = new ZarrLayerControl({
      collapsed: false,
      defaultVariable: "sst",
      localStoreProvider: async () => ({
        name: "demo.zarr",
        store: {
          get: async (key: string) =>
            key === ".zmetadata"
              ? encode({
                  metadata: {
                    "air/.zarray": { shape: [3, 4, 5] },
                    "sst/.zarray": { shape: [3, 4, 5] },
                  },
                })
              : undefined,
        },
      }),
    }) as any;
    control.onAdd(makeMockMap());
    await control._pickLocalStore();

    await control.fetchVariables();

    expect(control._state.variable).toBe("sst");
  });
});
