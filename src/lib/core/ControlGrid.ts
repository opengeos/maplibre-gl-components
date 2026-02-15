import "../styles/common.css";
import "../styles/control-grid.css";
import {
  FullscreenControl,
  GlobeControl,
  TerrainControl as MapLibreTerrainControl,
  type IControl,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type {
  ControlGridOptions,
  ControlGridState,
  ControlGridEvent,
  ControlGridEventHandler,
  DefaultControlName,
} from "./types";
import { SearchControl } from "./SearchControl";
import { ViewStateControl } from "./ViewStateControl";
import { InspectControl } from "./InspectControl";
import { VectorDatasetControl } from "./VectorDataset";
import { BasemapControl } from "./Basemap";
import { CogLayerControl } from "./CogLayer";
import { MinimapControl } from "./MinimapControl";
import { MeasureControl } from "./MeasureControl";
import { BookmarkControl } from "./BookmarkControl";
import { PrintControl } from "./PrintControl";
import { ZarrLayerControl } from "./ZarrLayer";
import { PMTilesLayerControl } from "./PMTilesLayer";
import { StacLayerControl } from "./StacLayer";
import { StacSearchControl } from "./StacSearch";
import { AddVectorControl } from "./AddVector";
import { ColorbarGuiControl } from "./ColorbarGuiControl";
import { LegendGuiControl } from "./LegendGuiControl";
import { HtmlGuiControl } from "./HtmlGuiControl";
import { CogLayerAdapter } from "../adapters/CogLayerAdapter";
import { ZarrLayerAdapter } from "../adapters/ZarrLayerAdapter";
import { PMTilesLayerAdapter } from "../adapters/PMTilesLayerAdapter";
import { AddVectorAdapter } from "../adapters/AddVectorAdapter";
import { StacLayerAdapter } from "../adapters/StacLayerAdapter";
import type { CustomLayerAdapter } from "../adapters/CogLayerAdapter";
import { GeoEditor, GeoEditorLayerAdapter } from "maplibre-gl-geo-editor";
import { LidarControl, LidarLayerAdapter } from "maplibre-gl-lidar";
import { PlanetaryComputerControl, PlanetaryComputerLayerAdapter } from "maplibre-gl-planetary-computer";
import { GaussianSplatControl, GaussianSplatLayerAdapter } from "maplibre-gl-splat";
import { StreetViewControl } from "maplibre-gl-streetview";
import { SwipeControl } from "maplibre-gl-swipe";
import { UsgsLidarControl, UsgsLidarLayerAdapter } from "maplibre-gl-usgs-lidar";


/** Optional fields that should not be made required */
type OptionalControlGridFields = "controls" | "defaultControls" | "basemapStyleUrl" | "excludeLayers" | "streetViewOptions";

/** ControlGrid options with required fields except for optional ones */
type ResolvedControlGridOptions = Required<Omit<ControlGridOptions, OptionalControlGridFields>>
  & Pick<ControlGridOptions, OptionalControlGridFields>;

/**
 * Default options for the ControlGrid.
 */
const DEFAULT_OPTIONS: ResolvedControlGridOptions = {
  title: "",
  position: "top-right",
  className: "",
  visible: true,
  collapsible: true,
  collapsed: true,
  rows: 1,
  columns: 3,
  showRowColumnControls: true,
  controls: [],
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  gap: 6,
  minzoom: 0,
  maxzoom: 24,
  basemapStyleUrl: undefined,
  excludeLayers: undefined,
  streetViewOptions: undefined,
};

/** Wrench icon SVG for collapsed state – stroke style matching MapLibre globe icon. */
const WRENCH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

/** Compass SVG matching MapLibre's built-in compass icon. */
const COMPASS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 29 29"><path d="m10.5 14 4-8 4 8z" fill="#333"/><path d="m10.5 16 4 8 4-8z" fill="#ccc"/></svg>`;

/**
 * Lightweight compass button that resets bearing to north.
 * Mirrors MapLibre's NavigationControl compass without the zoom buttons.
 */
class NorthControl implements IControl {
  private _map?: MapLibreMap;
  private _container?: HTMLElement;
  private _icon?: HTMLElement;
  private _rotateHandler?: () => void;

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const btn = document.createElement("button");
    btn.className = "maplibregl-ctrl-compass";
    btn.type = "button";
    btn.title = "Reset bearing to north";
    btn.setAttribute("aria-label", "Reset bearing to north");

    this._icon = document.createElement("span");
    this._icon.className = "maplibregl-ctrl-icon";
    this._icon.setAttribute("aria-hidden", "true");
    this._icon.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(COMPASS_SVG)}")`;
    this._icon.style.backgroundSize = "contain";
    this._icon.style.width = "29px";
    this._icon.style.height = "29px";
    this._icon.style.display = "block";

    btn.appendChild(this._icon);
    btn.addEventListener("click", () => this._map?.resetNorth());
    this._container.appendChild(btn);

    this._rotateHandler = () => {
      if (this._icon && this._map) {
        this._icon.style.transform = `rotate(${-this._map.getBearing()}deg)`;
      }
    };
    this._map.on("rotate", this._rotateHandler);
    this._rotateHandler();

    return this._container;
  }

  onRemove(): void {
    if (this._map && this._rotateHandler) {
      this._map.off("rotate", this._rotateHandler);
    }
    this._container?.parentNode?.removeChild(this._container);
    this._map = undefined;
    this._container = undefined;
    this._icon = undefined;
  }
}

const DEM_SOURCE_ID = "maplibre-gl-components-terrain-dem";
const DEM_TILE_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/**
 * Wrapper around MapLibre's built-in TerrainControl that auto-adds
 * a raster-DEM source using Terrarium tiles.
 */
class DemTerrainControl implements IControl {
  private _inner?: MapLibreTerrainControl;

  private _addSource(map: MapLibreMap): void {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, {
        type: "raster-dem",
        tiles: [DEM_TILE_URL],
        tileSize: 256,
        encoding: "terrarium",
      });
    }
  }

  onAdd(map: MapLibreMap): HTMLElement {
    if (map.isStyleLoaded()) {
      this._addSource(map);
    } else {
      map.once("styledata", () => this._addSource(map));
    }
    this._inner = new MapLibreTerrainControl({ source: DEM_SOURCE_ID });
    return this._inner.onAdd(map);
  }

  onRemove(): void {
    this._inner?.onRemove();
    this._inner = undefined;
  }
}

interface ChildEntry {
  control: IControl;
  element: HTMLElement | null;
  expandable: boolean;
  collapsedSnapshot: HTMLElement | null;
  expandHandler: (() => void) | null;
  collapseHandler: (() => void) | null;
  _placeholder: HTMLElement | null;
  _externalPanel: HTMLElement | null;
  _externalPanelParent: HTMLElement | null;
  /** Saved positioning methods (overridden to no-op during relocation) */
  _savedPositionMethods: Record<string, () => void> | null;
  /** Tooltip text to apply if the control's button has no title */
  tooltip?: string;
}

/** Human-readable tooltip labels for default controls. */
const DEFAULT_CONTROL_TOOLTIPS: Record<string, string> = {
  fullscreen: "Toggle fullscreen",
  globe: "Toggle globe projection",
  north: "Reset bearing to north",
  terrain: "Toggle terrain",
  search: "Search places",
  viewState: "View map state",
  inspect: "Inspect features",
  vectorDataset: "Add vector dataset",
  basemap: "Basemaps",
  cogLayer: "COG Layer",
  minimap: "Toggle minimap",
  measure: "Measure distances and areas",
  bookmark: "Bookmarks",
  print: "Export map",
  zarrLayer: "Zarr Layer",
  pmtilesLayer: "PMTiles Layer",
  stacLayer: "STAC Layer",
  stacSearch: "STAC Search",
  addVector: "Add vector layer",
  geoEditor: "Geo Editor",
  lidar: "LiDAR Layer",
  planetaryComputer: "Planetary Computer",
  gaussianSplat: "Gaussian Splat",
  streetView: "Street View",
  swipe: "Layer Swipe",
  usgsLidar: "USGS LiDAR",
  colorbarGui: "Colorbar",
  legendGui: "Legend",
  htmlGui: "HTML Control",
};

/**
 * A collapsible grid container for MapLibre IControl instances.
 *
 * Hosts multiple controls (e.g. SearchControl, TerrainControl) in a grid layout.
 * Users can configure rows/columns and dynamically add or remove controls.
 *
 * @example
 * ```typescript
 * const grid = new ControlGrid({
 *   title: 'Map Tools',
 *   rows: 2,
 *   columns: 2,
 *   collapsible: true,
 * });
 * grid.addControl(new TerrainControl());
 * grid.addControl(new SearchControl());
 * map.addControl(grid, 'top-right');
 * ```
 */
export class ControlGrid implements IControl {
  private _container?: HTMLElement;
  private _gridEl?: HTMLElement;
  private _options: ResolvedControlGridOptions;
  private _state: ControlGridState;
  private _children: ChildEntry[] = [];
  private _eventHandlers: Map<ControlGridEvent, Set<ControlGridEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _floatingEntry: ChildEntry | null = null;
  private _floatingPanel: HTMLElement | null = null;
  /** True during a click that originated inside the grid (not the floating panel). */
  private _clickInGrid: boolean = false;
  private _docCaptureHandler?: (e: MouseEvent) => void;
  private _docBubbleHandler?: (e: MouseEvent) => void;

  constructor(options?: ControlGridOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      rows: this._options.rows,
      columns: this._options.columns,
    };
    // Add explicitly passed controls
    const initial = options?.controls ?? this._options.controls ?? [];
    initial.forEach((c) =>
      this._children.push({
        control: c,
        element: null,
        expandable: this._isExpandable(c),
        collapsedSnapshot: null,
        expandHandler: null,
        collapseHandler: null,
        _placeholder: null,
        _externalPanel: null,
        _externalPanelParent: null,
        _savedPositionMethods: null,
      }),
    );

    // Create and add built-in default controls
    const defaults = options?.defaultControls ?? [];
    for (const name of defaults) {
      const ctrl = this._createDefaultControl(name);
      if (ctrl)
        this._children.push({
          control: ctrl,
          element: null,
          expandable: this._isExpandable(ctrl),
          collapsedSnapshot: null,
          expandHandler: null,
          collapseHandler: null,
          _placeholder: null,
          _externalPanel: null,
          _externalPanelParent: null,
          _savedPositionMethods: null,
          tooltip: DEFAULT_CONTROL_TOOLTIPS[name],
        });
    }
    this._autoGrowRows();
  }

  private _createDefaultControl(
    name: DefaultControlName,
  ): IControl | null {
    switch (name) {
      case "fullscreen":
        return new FullscreenControl();
      case "globe":
        return new GlobeControl();
      case "north":
        return new NorthControl();
      case "terrain":
        return new DemTerrainControl();
      case "search":
        return new SearchControl({ collapsed: true });
      case "viewState":
        return new ViewStateControl({ collapsed: true, enableBBox: true });
      case "inspect":
        return new InspectControl();
      case "vectorDataset":
        return new VectorDatasetControl();
      case "basemap":
        return new BasemapControl({ collapsed: true });
      case "cogLayer":
        return new CogLayerControl({
          collapsed: true,
          defaultUrl:
            "https://data.source.coop/giswqs/opengeos/nlcd_2021_land_cover_30m.tif",
          defaultColormap: "none",
          defaultRescaleMin: 0,
          defaultRescaleMax: 4000,
        });
      case "minimap":
        return new MinimapControl({ collapsed: true, interactive: true });
      case "measure":
        return new MeasureControl({ collapsed: true });
      case "bookmark":
        return new BookmarkControl({ collapsed: true });
      case "print":
        return new PrintControl({ collapsed: true });
      case "zarrLayer":
        return new ZarrLayerControl({
          collapsed: true,
          defaultUrl:
            "https://carbonplan-maps.s3.us-west-2.amazonaws.com/v2/demo/4d/tavg-prec-month",
          defaultVariable: "climate",
          defaultColormap: [
            "#f7fbff",
            "#deebf7",
            "#c6dbef",
            "#9ecae1",
            "#6baed6",
            "#4292c6",
            "#2171b5",
            "#08519c",
            "#08306b",
          ],
          defaultClim: [0, 300],
          defaultSelector: { band: "prec", month: 1 },
          defaultOpacity: 0.8,
        });
      case "pmtilesLayer":
        return new PMTilesLayerControl({
          collapsed: true,
          defaultUrl:
            "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles",
          defaultOpacity: 0.8,
          defaultFillColor: "steelblue",
          defaultLineColor: "#333",
        });
      case "stacLayer":
        return new StacLayerControl({
          collapsed: true,
          defaultUrl:
            "https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2B_10SEG_20251229_0_L2A",
          defaultRescaleMin: 0,
          defaultRescaleMax: 255,
          defaultColormap: "none",
        });
      case "stacSearch":
        return new StacSearchControl({
          collapsed: true,
          catalogs: [
            {
              name: "Element84 Earth Search",
              url: "https://earth-search.aws.element84.com/v1",
            },
            {
              name: "Microsoft Planetary Computer",
              url: "https://planetarycomputer.microsoft.com/api/stac/v1",
            },
          ],
          maxItems: 20,
          defaultRescaleMin: 0,
          defaultRescaleMax: 10000,
          showFootprints: true,
        });
      case "addVector":
        return new AddVectorControl({
          collapsed: true,
          defaultUrl:
            "https://flatgeobuf.org/test/data/UScounties.fgb",
        });
      case "geoEditor":
        return new GeoEditor({ collapsed: true, columns: 2 }) as unknown as IControl;
      case "lidar":
        return new LidarControl({ collapsed: true, maxHeight: 500 }) as unknown as IControl;
      case "planetaryComputer":
        return new PlanetaryComputerControl({ collapsed: true, maxHeight: 500 }) as unknown as IControl;
      case "gaussianSplat":
        return new GaussianSplatControl({ collapsed: true, maxHeight: 500 }) as unknown as IControl;
      case "streetView": {
        const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
        const googleApiKey = env?.VITE_GOOGLE_MAPS_API_KEY;
        const mapillaryAccessToken = env?.VITE_MAPILLARY_ACCESS_TOKEN;
        const defaultProvider: "google" | "mapillary" =
          !googleApiKey && mapillaryAccessToken ? "mapillary" : "google";

        return new StreetViewControl({
          collapsed: true,
          panelWidth: 450,
          panelHeight: 350,
          maxHeight: 500,
          defaultProvider,
          clickToView: true,
          showMarker: true,
          maxSearchRadius: 200,
          markerOptions: {
            color: "#ff5722",
            showDirection: false,
            directionColor: "#1976d2",
          },
          googleApiKey,
          mapillaryAccessToken,
          ...this._options.streetViewOptions,
        }) as unknown as IControl;
      }
      case "swipe":
        return new SwipeControl({
          collapsed: true,
          maxHeight: 500,
          active: false,
          basemapStyle: this._options.basemapStyleUrl,
          excludeLayers: this._options.excludeLayers,
        }) as unknown as IControl;
      case "usgsLidar":
        return new UsgsLidarControl({ collapsed: true, maxHeight: 500 }) as unknown as IControl;
      case "colorbarGui":
        return new ColorbarGuiControl({ collapsed: true });
      case "legendGui":
        return new LegendGuiControl({ collapsed: true });
      case "htmlGui":
        return new HtmlGuiControl({ collapsed: true });
      default:
        return null;
    }
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);
    this._checkZoomVisibility();

    // Register capture-phase click listener on document BEFORE children
    // are mounted, so it fires before any child control's capture handlers.
    // This flags clicks inside the grid (but not the floating panel) so the
    // collapse override can block capture-phase click-outside handlers.
    // Capture-phase handler: set _clickInGrid BEFORE child handlers run.
    // We set it true for clicks in the grid (but not floating panel), and
    // explicitly reset to false otherwise. This ensures the flag is always
    // correct for the current click, even if a previous bubble handler was
    // blocked by stopPropagation.
    this._docCaptureHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = this._container?.contains(target);
      const inFloating = this._floatingPanel?.contains(target);
      // Clicks in the grid container (but NOT in floating panel) block collapse
      this._clickInGrid = !!(inContainer && !inFloating);
    };
    // Bubble-phase handler: reset _clickInGrid AFTER all handlers have run
    this._docBubbleHandler = () => {
      this._clickInGrid = false;
    };
    document.addEventListener("click", this._docCaptureHandler, true);
    document.addEventListener("click", this._docBubbleHandler, false);

    this._render();
    this._mountChildren();

    return this._container;
  }

  onRemove(): void {
    if (this._docCaptureHandler) {
      document.removeEventListener("click", this._docCaptureHandler, true);
      this._docCaptureHandler = undefined;
    }
    if (this._docBubbleHandler) {
      document.removeEventListener("click", this._docBubbleHandler, false);
      this._docBubbleHandler = undefined;
    }
    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }
    this._unmountChildren();
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._gridEl = undefined;
    this._children = [];
    this._eventHandlers.clear();
  }

  /**
   * Add a control to the grid. If the control is already on the map, it is mounted into the grid.
   */
  addControl(control: IControl): void {
    if (this._children.some((e) => e.control === control)) return;
    const entry: ChildEntry = {
      control,
      element: null,
      expandable: this._isExpandable(control),
      collapsedSnapshot: null,
      expandHandler: null,
      collapseHandler: null,
      _placeholder: null,
      _externalPanel: null,
      _externalPanelParent: null,
      _savedPositionMethods: null,
    };
    this._children.push(entry);
    this._autoGrowRows();
    if (this._map && this._gridEl) {
      entry.element = control.onAdd(this._map);
      if (entry.expandable) {
        entry.collapsedSnapshot = entry.element.cloneNode(
          true,
        ) as HTMLElement;
        this._attachExpandListeners(entry);
      }
      this._gridEl.appendChild(entry.element);
    }
    this._emit("controladd", control);
  }

  /**
   * Remove a control from the grid. The control's onRemove is called.
   */
  removeControl(control: IControl): void {
    const index = this._children.findIndex((e) => e.control === control);
    if (index === -1) return;
    const entry = this._children[index];
    // If this control is currently floating, clear it first
    if (this._floatingEntry === entry) {
      this._clearFloating();
    }
    this._detachExpandListeners(entry);
    if (entry._placeholder?.parentNode) {
      entry._placeholder.parentNode.removeChild(entry._placeholder);
    }
    if (entry.element?.parentNode) {
      entry.element.parentNode.removeChild(entry.element);
    }
    if (this._map) control.onRemove(this._map);
    this._children.splice(index, 1);
    this._emit("controlremove", control);
  }

  /**
   * Set the number of grid rows.
   */
  setRows(rows: number): void {
    const n = Math.max(1, Math.min(12, Math.round(rows)));
    if (this._state.rows === n) return;
    this._state.rows = n;
    this._applyGridStyle();
    this._emit("update");
  }

  /**
   * Set the number of grid columns.
   */
  setColumns(columns: number): void {
    const n = Math.max(1, Math.min(12, Math.round(columns)));
    if (this._state.columns === n) return;
    this._state.columns = n;
    this._applyGridStyle();
    this._emit("update");
  }

  /**
   * Get the list of controls currently in the grid.
   */
  getControls(): IControl[] {
    return this._children.map((e) => e.control);
  }

  /**
   * Create custom layer adapters for all data-layer controls in the grid.
   * Returns adapters suitable for registering with a LayerControl via
   * `layerControl.registerCustomAdapter(adapter)`.
   *
   * Supported controls: CogLayerControl, ZarrLayerControl,
   * PMTilesLayerControl, StacLayerControl, AddVectorControl.
   */
  getAdapters(): CustomLayerAdapter[] {
    const adapters: CustomLayerAdapter[] = [];
    for (const entry of this._children) {
      const ctrl = entry.control;
      if (ctrl instanceof CogLayerControl) {
        adapters.push(new CogLayerAdapter(ctrl));
      } else if (ctrl instanceof ZarrLayerControl) {
        adapters.push(new ZarrLayerAdapter(ctrl));
      } else if (ctrl instanceof PMTilesLayerControl) {
        adapters.push(new PMTilesLayerAdapter(ctrl));
      } else if (ctrl instanceof StacLayerControl) {
        adapters.push(new StacLayerAdapter(ctrl));
      } else if (ctrl instanceof AddVectorControl) {
        adapters.push(new AddVectorAdapter(ctrl));
      } else if (ctrl instanceof LidarControl) {
        adapters.push(new LidarLayerAdapter(ctrl));
      } else if (ctrl instanceof PlanetaryComputerControl) {
        adapters.push(new PlanetaryComputerLayerAdapter(ctrl));
      } else if (ctrl instanceof GaussianSplatControl) {
        adapters.push(new GaussianSplatLayerAdapter(ctrl));
      } else if (ctrl instanceof UsgsLidarControl) {
        adapters.push(new UsgsLidarLayerAdapter(ctrl));
      } else if (ctrl instanceof GeoEditor) {
        adapters.push(new GeoEditorLayerAdapter(ctrl));
      }
    }
    return adapters;
  }

  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit("show");
    }
  }

  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit("hide");
    }
  }

  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit("expand");
    }
  }

  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit("collapse");
    }
  }

  toggle(): void {
    if (this._state.collapsed) this.expand();
    else this.collapse();
  }

  getState(): ControlGridState {
    return { ...this._state };
  }

  update(options: Partial<ControlGridOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    if (options.rows !== undefined)
      this._state.rows = Math.max(1, Math.min(12, options.rows));
    if (options.columns !== undefined)
      this._state.columns = Math.max(1, Math.min(12, options.columns));
    this._render();
    this._emit("update");
  }

  on(event: ControlGridEvent, handler: ControlGridEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: ControlGridEvent, handler: ControlGridEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private _emit(event: ControlGridEvent, control?: IControl): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), control };
      handlers.forEach((h) => h(payload));
    }
  }

  private _checkZoomVisibility(): void {
    if (!this._map) return;
    const zoom = this._map.getZoom();
    const { minzoom, maxzoom } = this._options;
    const inRange = zoom >= minzoom && zoom <= maxzoom;
    if (inRange !== this._zoomVisible) {
      this._zoomVisible = inRange;
      this._updateDisplayState();
    }
  }

  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? "block" : "none";
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-control-grid${
      this._options.className ? ` ${this._options.className}` : ""
    }`;
    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) container.style.display = "none";
    // Prevent clicks inside the grid from reaching document-level
    // click-outside handlers that upstream plugins use to auto-collapse.
    container.addEventListener("click", (e) => e.stopPropagation());
    return container;
  }

  private _autoGrowRows(): void {
    const capacity = this._state.rows * this._state.columns;
    if (this._children.length > capacity) {
      this._state.rows = Math.ceil(this._children.length / this._state.columns);
      this._applyGridStyle();
    }
  }

  private _applyGridStyle(): void {
    if (!this._gridEl) return;
    if (this._state.collapsed) {
      this._gridEl.style.display = "none";
      return;
    }
    const gap = this._options.gap;
    this._gridEl.style.display = "grid";
    this._gridEl.style.gridTemplateColumns = `repeat(${this._state.columns}, auto)`;
    this._gridEl.style.gridTemplateRows = `repeat(${this._state.rows}, auto)`;
    this._gridEl.style.gap = `${gap}px`;
    // Center grid tracks and controls to balance left/right padding when the header is wider.
    this._gridEl.style.width = "100%";
    this._gridEl.style.justifyContent = "center";
    this._gridEl.style.alignContent = "center";
    this._gridEl.style.justifyItems = "center";
    this._gridEl.style.alignItems = "center";
  }

  private _mountChildren(): void {
    if (!this._map || !this._gridEl) return;
    this._children.forEach((entry) => {
      if (!entry.element) {
        entry.element = entry.control.onAdd(this._map!);
        // Apply tooltip to the button if the control doesn't already set one
        if (entry.tooltip) {
          this._applyTooltip(entry.element, entry.tooltip);
        }
        // Capture collapsed snapshot on first mount for expandable controls
        if (entry.expandable && !entry.collapsedSnapshot) {
          entry.collapsedSnapshot = entry.element.cloneNode(
            true,
          ) as HTMLElement;
        }
        this._attachExpandListeners(entry);
      }

      // If this entry is the currently floating one, mount as floating
      if (this._floatingEntry === entry) {
        this._mountAsFloating(entry);
      } else {
        if (entry.element.parentNode !== this._gridEl) {
          this._gridEl!.appendChild(entry.element);
        }
      }
    });
  }

  /**
   * Set title on the control's button if it doesn't already have one.
   */
  private _applyTooltip(element: HTMLElement, tooltip: string): void {
    const btn = element.querySelector("button");
    if (btn && !btn.title) {
      btn.title = tooltip;
    }
  }

  private _unmountChildren(): void {
    this._clearFloating();
    const map = this._map;
    this._children.forEach((entry) => {
      this._detachExpandListeners(entry);
      if (entry._placeholder?.parentNode) {
        entry._placeholder.parentNode.removeChild(entry._placeholder);
      }
      entry._placeholder = null;
      if (entry.element?.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      if (map) entry.control.onRemove(map);
    });
    this._children = this._children.map((e) => ({
      control: e.control,
      element: null,
      expandable: e.expandable,
      collapsedSnapshot: null,
      expandHandler: null,
      collapseHandler: null,
      _placeholder: null,
      _externalPanel: null,
      _externalPanelParent: null,
      _savedPositionMethods: null,
    }));
  }

  private _isExpandable(control: IControl): boolean {
    const ctrl = control as any;
    return (
      typeof ctrl.on === "function" &&
      typeof ctrl.collapse === "function"
    );
  }

  private _attachExpandListeners(entry: ChildEntry): void {
    if (!entry.expandable) return;
    const ctrl = entry.control as any;
    entry.expandHandler = () => this._onChildExpand(entry);
    entry.collapseHandler = () => this._onChildCollapse(entry);
    ctrl.on("expand", entry.expandHandler);
    ctrl.on("collapse", entry.collapseHandler);
  }

  private _detachExpandListeners(entry: ChildEntry): void {
    if (!entry.expandable) return;
    const ctrl = entry.control as any;
    if (entry.expandHandler) ctrl.off("expand", entry.expandHandler);
    if (entry.collapseHandler) ctrl.off("collapse", entry.collapseHandler);
    entry.expandHandler = null;
    entry.collapseHandler = null;
  }

  private _onChildExpand(entry: ChildEntry): void {
    // If another child is already floating, collapse it first
    if (this._floatingEntry && this._floatingEntry !== entry) {
      this._collapseFloatingChild();
    }

    if (!entry.element || !this._gridEl) return;

    // Create placeholder from collapsed snapshot
    const placeholder = entry.collapsedSnapshot
      ? (entry.collapsedSnapshot.cloneNode(true) as HTMLElement)
      : document.createElement("div");
    placeholder.classList.add("maplibre-gl-control-grid-placeholder--active");
    placeholder.addEventListener("click", () => {
      (entry.control as any).collapse();
      // Ensure cleanup even if the control was already collapsed (no-op collapse)
      if (this._floatingEntry === entry) {
        this._onChildCollapse(entry);
      }
    });
    entry._placeholder = placeholder;

    // Replace the element in the grid with the placeholder
    this._gridEl.replaceChild(placeholder, entry.element);

    // Move element into floating panel
    const panel = this._ensureFloatingPanel();
    panel.appendChild(entry.element);
    this._floatingEntry = entry;

    // Relocate external panel (appended to map container) into floating panel
    this._relocateExternalPanel(entry, panel);

    // For internal controls (no external panel), hide the toggle button
    // so only the panel content is visible in the floating panel.
    this._hideFloatingButton(entry);
  }

  private _onChildCollapse(entry: ChildEntry): void {
    if (this._floatingEntry !== entry) return;

    // Show the toggle button again before moving back to grid
    this._showFloatingButton(entry);

    // Restore external panel to its original parent
    this._restoreExternalPanel(entry);

    // Move element back to the grid, replacing placeholder
    if (entry._placeholder && entry.element && this._gridEl) {
      if (entry._placeholder.parentNode === this._gridEl) {
        this._gridEl.replaceChild(entry.element, entry._placeholder);
      } else {
        this._gridEl.appendChild(entry.element);
      }
    }
    entry._placeholder = null;

    // Hide floating panel
    if (this._floatingPanel) {
      this._floatingPanel.style.display = "none";
    }
    this._floatingEntry = null;

    // Now that _floatingEntry is null (preventing re-entry), collapse the
    // control so its internal state matches and the panel is hidden.
    const ctrl = entry.control as any;
    if (typeof ctrl.collapse === "function") {
      ctrl.collapse();
    }

    // Update collapsed snapshot AFTER the control has collapsed,
    // so the snapshot captures the collapsed (not expanded) DOM.
    if (entry.element) {
      entry.collapsedSnapshot = entry.element.cloneNode(true) as HTMLElement;
    }
  }

  private _mountAsFloating(entry: ChildEntry): void {
    if (!this._gridEl || !entry.element) return;

    // Put placeholder in grid
    const placeholder = entry.collapsedSnapshot
      ? (entry.collapsedSnapshot.cloneNode(true) as HTMLElement)
      : document.createElement("div");
    placeholder.classList.add("maplibre-gl-control-grid-placeholder--active");
    placeholder.addEventListener("click", () => {
      (entry.control as any).collapse();
      // Ensure cleanup even if the control was already collapsed (no-op collapse)
      if (this._floatingEntry === entry) {
        this._onChildCollapse(entry);
      }
    });
    entry._placeholder = placeholder;
    this._gridEl.appendChild(placeholder);

    // Put element in floating panel
    const panel = this._ensureFloatingPanel();
    panel.appendChild(entry.element);

    // Relocate external panel (appended to map container) into floating panel
    this._relocateExternalPanel(entry, panel);

    // If the external panel is already relocated (e.g. after a re-render),
    // _relocateExternalPanel bails early, so re-apply right:0px here.
    if (entry._externalPanel) {
      panel.style.right = "0px";
    }

    // For internal controls (no external panel), hide the toggle button
    // so only the panel content is visible in the floating panel.
    this._hideFloatingButton(entry);
  }

  private _ensureFloatingPanel(): HTMLElement {
    if (!this._floatingPanel) {
      this._floatingPanel = document.createElement("div");
      this._floatingPanel.className =
        "maplibre-gl-control-grid-floating-panel";
      // Prevent clicks inside the floating panel from reaching document-level
      // click-outside handlers that upstream plugins use to auto-collapse.
      this._floatingPanel.addEventListener("click", (e) =>
        e.stopPropagation(),
      );
    }
    // Always re-attach to container (it may have been removed by _render's innerHTML="")
    if (this._container && this._floatingPanel.parentNode !== this._container) {
      this._container.appendChild(this._floatingPanel);
    }
    // Compensate for container padding so the panel's right edge aligns
    // with the container's outer edge.
    const isCollapsedWithHeader =
      this._state.collapsed &&
      (this._options.title || this._options.collapsible);
    const expandedOffset = Math.max(0, this._options.padding - 1);
    const expandedContainerPad = Math.max(0, this._options.padding - 10);
    const rightPad = isCollapsedWithHeader
      ? expandedOffset - expandedContainerPad
      : expandedOffset;
    this._floatingPanel.style.right = `-${rightPad}px`;
    this._floatingPanel.style.display = "block";
    return this._floatingPanel;
  }

  private _clearFloating(): void {
    if (this._floatingEntry) {
      // Restore button visibility and external panel before clearing
      this._showFloatingButton(this._floatingEntry);
      this._restoreExternalPanel(this._floatingEntry);
      this._floatingEntry._placeholder = null;
    }
    this._floatingEntry = null;
    if (this._floatingPanel) {
      this._floatingPanel.remove();
      this._floatingPanel = null;
    }
  }

  private _collapseFloatingChild(): void {
    if (!this._floatingEntry) return;
    // Call _onChildCollapse directly rather than ctrl.collapse()
    // to bypass the collapse override that blocks click-outside handlers.
    this._onChildCollapse(this._floatingEntry);
  }

  /**
   * Hide the control's toggle button when it is inside the floating panel
   * so only the expanded panel content is visible.
   * Only applies to internal controls (no external panel).
   */
  private _hideFloatingButton(entry: ChildEntry): void {
    if (entry._externalPanel) return; // external panels handle this differently
    const ctrl = entry.control as any;
    if (ctrl._button) {
      ctrl._button.style.display = "none";
      if (entry.element) {
        // Remove maplibregl-ctrl-group which constrains width and clips
        // overflow, preventing the inner panel from sizing correctly.
        const hasCtrlGroup =
          entry.element.classList.contains("maplibregl-ctrl-group");
        if (hasCtrlGroup) {
          entry.element.classList.remove("maplibregl-ctrl-group");
          entry.element.dataset.hadCtrlGroup = "1";
        }
        // Controls that never had ctrl-group (e.g. Bookmark, Print) don't
        // need MapLibre's positional margin-right inside the floating panel.
        if (!hasCtrlGroup && !entry.element.dataset.hadCtrlGroup) {
          entry.element.style.marginRight = "0";
        }
      }
    }
  }

  /**
   * Restore the control's toggle button visibility when moving
   * back from the floating panel to the grid.
   */
  private _showFloatingButton(entry: ChildEntry): void {
    const ctrl = entry.control as any;
    if (ctrl._button) {
      ctrl._button.style.display = "";
      if (entry.element) {
        if (entry.element.dataset.hadCtrlGroup) {
          entry.element.classList.add("maplibregl-ctrl-group");
          delete entry.element.dataset.hadCtrlGroup;
        } else {
          entry.element.style.marginRight = "";
        }
      }
    }
  }

  /**
   * Move an external panel (appended to the map container by the upstream control)
   * into the floating panel, stripping its absolute positioning.
   */
  private _relocateExternalPanel(
    entry: ChildEntry,
    floatingPanel: HTMLElement,
  ): void {
    const ctrl = entry.control as any;

    // Try getPanelElement() first, then fall back to ctrl._panel directly
    // (in case Vite's pre-bundled version doesn't include getPanelElement yet).
    let extPanel: HTMLElement | null = null;
    if (typeof ctrl.getPanelElement === "function") {
      extPanel = ctrl.getPanelElement() as HTMLElement | null;
    } else if (ctrl._panel instanceof HTMLElement) {
      extPanel = ctrl._panel;
    } else if (ctrl._panel && typeof ctrl._panel.getElement === "function") {
      // StreetView uses a Panel class with getElement()
      extPanel = ctrl._panel.getElement() as HTMLElement | null;
    }

    if (!extPanel || !entry.element || entry.element.contains(extPanel)) return;

    // Already relocated — skip to avoid overwriting _externalPanelParent
    if (entry._externalPanel) return;

    entry._externalPanelParent = extPanel.parentNode as HTMLElement;
    entry._externalPanel = extPanel;
    extPanel.classList.add("maplibre-gl-control-grid-relocated");

    // Override positioning methods to no-ops so the upstream control
    // cannot re-position the panel while it's inside the floating panel.
    const methods = ["_updatePanelPosition", "updatePanelPosition"];
    entry._savedPositionMethods = {};
    for (const m of methods) {
      if (typeof ctrl[m] === "function") {
        entry._savedPositionMethods[m] = ctrl[m].bind(ctrl);
        ctrl[m] = () => {};
      }
    }
    // StreetView uses a Panel class with its own positionRelativeTo method
    const panelObj = ctrl._panel;
    if (panelObj && typeof panelObj.positionRelativeTo === "function") {
      entry._savedPositionMethods["_panel.positionRelativeTo"] =
        panelObj.positionRelativeTo.bind(panelObj);
      panelObj.positionRelativeTo = () => {};
    }
    // Override collapse() so that close buttons inside the relocated panel
    // trigger proper grid cleanup via _onChildCollapse.
    // Bubble-phase click-outside handlers are already blocked by
    // stopPropagation on the grid container. Capture-phase handlers
    // (like USGS LiDAR) are blocked by checking _clickInGrid — set by
    // our capture listener on document registered before the child's.
    if (typeof ctrl.collapse === "function") {
      entry._savedPositionMethods["collapse"] = ctrl.collapse.bind(ctrl);
      ctrl.collapse = () => {
        // Only collapse if panel is floating AND click was outside the grid.
        // Clicks inside the grid (e.g. wrench icon) set _clickInGrid = true
        // in the capture phase, blocking the collapse.
        if (this._floatingEntry === entry && !this._clickInGrid) {
          this._onChildCollapse(entry);
        }
      };
    }

    // Force inline !important overrides for belt-and-suspenders safety.
    const force = (prop: string, val: string) =>
      extPanel.style.setProperty(prop, val, "important");
    force("position", "static");
    force("top", "auto");
    force("bottom", "auto");
    force("left", "auto");
    force("right", "auto");
    force("z-index", "auto");

    floatingPanel.appendChild(extPanel);

    // Shift the floating panel's right edge inward so the wide external
    // panel doesn't extend past the map edge.
    floatingPanel.style.right = "0px";

    // Hide the control's button element since the external panel has its
    // own header/close button — showing both causes visual overlap.
    if (entry.element) {
      entry.element.style.display = "none";
    }
  }

  /**
   * Move an external panel back to its original parent and clear
   * the inline overrides set during relocation.
   */
  private _restoreExternalPanel(entry: ChildEntry): void {
    if (!entry._externalPanel || !entry._externalPanelParent) return;

    const extPanel = entry._externalPanel;

    extPanel.classList.remove("maplibre-gl-control-grid-relocated");

    // Clear the inline !important overrides so the control's own
    // positioning logic works normally again.
    const props = ["position", "top", "bottom", "left", "right", "z-index"];
    for (const prop of props) {
      extPanel.style.removeProperty(prop);
    }

    entry._externalPanelParent.appendChild(extPanel);
    entry._externalPanel = null;
    entry._externalPanelParent = null;

    // Restore overridden methods to their original implementations
    if (entry._savedPositionMethods) {
      const ctrl = entry.control as any;
      for (const [key, fn] of Object.entries(entry._savedPositionMethods)) {
        if (key === "_panel.positionRelativeTo") {
          const panelObj = ctrl._panel;
          if (panelObj) panelObj.positionRelativeTo = fn;
        } else {
          ctrl[key] = fn;
        }
      }
      entry._savedPositionMethods = null;
    }

    // Show the control's button element again
    if (entry.element) {
      entry.element.style.display = "";
    }
  }

  private _render(): void {
    if (!this._container) return;

    const {
      title,
      collapsible,
      backgroundColor,
      opacity,
      borderRadius,
      padding,
      showRowColumnControls,
    } = this._options;

    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._container.classList.add("maplibre-gl-control-grid--collapsed");
    } else {
      this._container.classList.remove("maplibre-gl-control-grid--collapsed");
    }

    const isCollapsedWithHeader =
      this._state.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 0 : padding;
    const leftPadding = isCollapsedWithHeader ? 0 : padding;
    const rightPadding = isCollapsedWithHeader ? 0 : Math.max(0, padding - 4);
    const shouldShow = this._state.visible && this._zoomVisible;

    Object.assign(this._container.style, {
      backgroundColor,
      opacity: String(opacity),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${rightPadding}px ${vertPadding}px ${leftPadding}px`,
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      display: shouldShow ? "block" : "none",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: "#1a1a1a",
    });

    if (collapsible || title) {
      const header = document.createElement("div");
      header.className = "maplibre-gl-control-grid-header";
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: this._state.collapsed ? "center" : "space-between",
        flexWrap: "wrap",
        gap: "6px",
        paddingBottom: this._state.collapsed ? "0" : "0",
        cursor: collapsible ? "pointer" : "default",
      });

      if (this._state.collapsed && collapsible) {
        // Collapsed: show only a square wrench icon (no grid, no title)
        const iconWrap = document.createElement("span");
        iconWrap.className = "maplibre-gl-control-grid-wrench";
        iconWrap.innerHTML = WRENCH_ICON;
        Object.assign(iconWrap.style, {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "29px",
          height: "29px",
          lineHeight: "0",
          boxSizing: "border-box",
        });
        iconWrap.setAttribute("aria-label", "Map tools");
        header.appendChild(iconWrap);
        header.addEventListener("click", () => this.toggle());
      } else {
        // Expanded: title, row/column inputs, toggle arrow
        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.alignItems = "center";
        left.style.gap = "6px";

        if (title) {
          const titleEl = document.createElement("span");
          titleEl.className = "maplibre-gl-control-grid-title";
          titleEl.textContent = title;
          titleEl.style.fontWeight = "600";
          titleEl.style.color = "#333";
          left.appendChild(titleEl);
        }

        if (showRowColumnControls && !this._state.collapsed) {
          const rowLabel = document.createElement("label");
          rowLabel.style.display = "inline-flex";
          rowLabel.style.alignItems = "center";
          rowLabel.style.gap = "2px";
          rowLabel.style.fontSize = "11px";
          rowLabel.style.color = "#333";
          rowLabel.innerHTML = "R:";
          const rowInput = document.createElement("input");
          rowInput.type = "number";
          rowInput.min = "1";
          rowInput.max = "12";
          rowInput.value = String(this._state.rows);
          rowInput.style.width = "40px";
          rowInput.style.padding = "2px 2px";
          rowInput.style.boxSizing = "border-box";
          rowInput.style.textAlign = "center";
          rowInput.style.color = "#333";
          rowInput.addEventListener("change", () =>
            this.setRows(Number(rowInput.value) || 1),
          );
          rowLabel.appendChild(rowInput);

          const colLabel = document.createElement("label");
          colLabel.style.display = "inline-flex";
          colLabel.style.alignItems = "center";
          colLabel.style.gap = "2px";
          colLabel.style.fontSize = "11px";
          colLabel.style.color = "#333";
          colLabel.innerHTML = "C:";
          const colInput = document.createElement("input");
          colInput.type = "number";
          colInput.min = "1";
          colInput.max = "12";
          colInput.value = String(this._state.columns);
          colInput.style.width = "40px";
          colInput.style.padding = "2px 2px";
          colInput.style.boxSizing = "border-box";
          colInput.style.textAlign = "center";
          colInput.style.color = "#333";
          colInput.addEventListener("change", () =>
            this.setColumns(Number(colInput.value) || 1),
          );
          colLabel.appendChild(colInput);

          left.appendChild(rowLabel);
          left.appendChild(colLabel);
        }

        header.appendChild(left);

        if (collapsible) {
          const toggleBtn = document.createElement("span");
          toggleBtn.className = "maplibre-gl-control-grid-toggle";
          toggleBtn.innerHTML = "&#9660;";
          Object.assign(toggleBtn.style, {
            fontSize: "10px",
            userSelect: "none",
            color: "#333",
          });
          header.appendChild(toggleBtn);
          header.addEventListener("click", (ev) => {
            if (!showRowColumnControls || !left.contains(ev.target as Node))
              this.toggle();
          });
        }
      }

      this._container.appendChild(header);
    }

    const content = document.createElement("div");
    content.className = "maplibre-gl-control-grid-content";
    Object.assign(content.style, {
      display: this._state.collapsed ? "none" : "block",
    });
    this._gridEl = content;
    this._applyGridStyle();
    this._container.appendChild(content);

    this._mountChildren();
  }
}
