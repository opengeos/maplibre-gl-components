import "../styles/common.css";
import "../styles/stac-layer.css";
import maplibregl, {
  type IControl,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type {
  StacLayerControlOptions,
  StacLayerControlState,
  StacLayerEvent,
  StacLayerEventHandler,
  StacAssetInfo,
  ColormapName,
  ColorStop,
  ControlPosition,
} from "./types";
import { getColormap } from "../colormaps";

/**
 * Shader module that rescales float raster values to [0,1] for visualization.
 * Single-band: maps value from [minVal, maxVal] to grayscale.
 * Multi-band: rescales each channel independently.
 */
const RescaleFloat = {
  name: "rescaleFloat",
  fs: `\
uniform rescaleFloatUniforms {
  float minVal;
  float maxVal;
  float isSingleBand;
} rescaleFloat;
`,
  inject: {
    "fs:DECKGL_FILTER_COLOR": /* glsl */ `
    float range = rescaleFloat.maxVal - rescaleFloat.minVal;
    if (range > 0.0) {
      if (rescaleFloat.isSingleBand > 0.5) {
        float val = clamp((color.r - rescaleFloat.minVal) / range, 0.0, 1.0);
        color = vec4(val, val, val, 1.0);
      } else {
        color.r = clamp((color.r - rescaleFloat.minVal) / range, 0.0, 1.0);
        color.g = clamp((color.g - rescaleFloat.minVal) / range, 0.0, 1.0);
        color.b = clamp((color.b - rescaleFloat.minVal) / range, 0.0, 1.0);
      }
    }
    `,
  },
  uniformTypes: {
    minVal: "f32" as const,
    maxVal: "f32" as const,
    isSingleBand: "f32" as const,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUniforms: (props: any) => ({
    minVal: props.minVal,
    maxVal: props.maxVal,
    isSingleBand: props.isSingleBand,
  }),
};

/**
 * Recursively apply opacity to deck.gl sublayers via clone().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOpacity(layers: any, opacity: number): any {
  if (!layers) return layers;
  if (Array.isArray(layers)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return layers.map((layer: any) => applyOpacity(layer, opacity));
  }
  if (typeof layers.clone === "function") {
    return layers.clone({ opacity });
  }
  return layers;
}

/**
 * Parse a CSS hex color (#RGB or #RRGGBB) to [r, g, b] values (0-255).
 */
function parseHexColor(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Build a 256×1 RGBA ImageData from an array of ColorStops.
 * Linearly interpolates between stops.
 */
function colormapToImageData(stops: ColorStop[]): ImageData {
  const size = 256;
  const rgba = new Uint8ClampedArray(size * 4);
  const parsed = stops.map((s) => ({
    pos: s.position,
    rgb: parseHexColor(s.color),
  }));
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    // Find surrounding stops
    let lo = parsed[0],
      hi = parsed[parsed.length - 1];
    for (let j = 0; j < parsed.length - 1; j++) {
      if (t >= parsed[j].pos && t <= parsed[j + 1].pos) {
        lo = parsed[j];
        hi = parsed[j + 1];
        break;
      }
    }
    const range = hi.pos - lo.pos;
    const f = range > 0 ? (t - lo.pos) / range : 0;
    rgba[i * 4] = lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * f;
    rgba[i * 4 + 1] = lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * f;
    rgba[i * 4 + 2] = lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * f;
    rgba[i * 4 + 3] = 255;
  }
  return new ImageData(rgba, size, 1);
}

/**
 * Interpolate a colormap at position t (0-1) and return [R, G, B] values (0-255).
 */
function interpolateColormap(
  stops: ColorStop[],
  t: number,
): [number, number, number] {
  const parsed = stops.map((s) => ({
    pos: s.position,
    rgb: parseHexColor(s.color),
  }));

  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find surrounding stops
  let lo = parsed[0],
    hi = parsed[parsed.length - 1];
  for (let j = 0; j < parsed.length - 1; j++) {
    if (t >= parsed[j].pos && t <= parsed[j + 1].pos) {
      lo = parsed[j];
      hi = parsed[j + 1];
      break;
    }
  }

  const range = hi.pos - lo.pos;
  const f = range > 0 ? (t - lo.pos) / range : 0;

  return [
    Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * f),
    Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * f),
    Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * f),
  ];
}

/**
 * All available colormap names.
 */
const COLORMAP_NAMES: ColormapName[] = [
  "viridis",
  "plasma",
  "inferno",
  "magma",
  "cividis",
  "coolwarm",
  "bwr",
  "seismic",
  "RdBu",
  "RdYlBu",
  "RdYlGn",
  "spectral",
  "jet",
  "rainbow",
  "turbo",
  "terrain",
  "ocean",
  "hot",
  "cool",
  "gray",
  "bone",
];

/**
 * Default options for the StacLayerControl.
 */
const DEFAULT_OPTIONS: Required<StacLayerControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  beforeId: "",
  defaultUrl: "",
  loadDefaultUrl: false,
  defaultColormap: "none",
  defaultRescaleMin: 0,
  defaultRescaleMax: 255,
  defaultLayerName: "",
  defaultOpacity: 1,
  defaultPickable: true,
  panelWidth: 320,
  maxHeight: 500,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  fontSize: 13,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * STAC/satellite icon SVG for the control button.
 */
const STAC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <path d="M2 12h4"/>
  <path d="M18 12h4"/>
  <path d="M12 2v4"/>
  <path d="M12 18v4"/>
  <circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.2"/>
</svg>`;

/**
 * A control for loading and displaying COG layers from STAC items.
 *
 * @example
 * ```typescript
 * const stacControl = new StacLayerControl({
 *   defaultUrl: 'https://example.com/stac-item.json',
 *   loadDefaultUrl: true,
 * });
 * map.addControl(stacControl, 'top-right');
 * ```
 */
export class StacLayerControl implements IControl {
  private _container?: HTMLElement;
  // @ts-expect-error - Used for potential future reference/debugging
  private _button?: HTMLButtonElement;
  // @ts-expect-error - Used for potential future reference/debugging
  private _panel?: HTMLElement;
  private _colormapPreview?: HTMLElement;
  private _options: Required<StacLayerControlOptions>;
  private _state: StacLayerControlState;
  private _eventHandlers: Map<StacLayerEvent, Set<StacLayerEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _deckOverlay?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayers: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayerPropsMap: Map<string, Record<string, any>> = new Map();
  private _layerCounter = 0;
  private _activePopup?: maplibregl.Popup;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _mapClickHandler?: (e: any) => void;

  constructor(options?: StacLayerControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      layerName: this._options.defaultLayerName,
      stacUrl: this._options.defaultUrl,
      stacItem: null,
      assets: [],
      selectedAsset: null,
      rgbMode: false,
      rgbAssets: [null, null, null],
      colormap: this._options.defaultColormap,
      rescaleMin: this._options.defaultRescaleMin,
      rescaleMax: this._options.defaultRescaleMax,
      layerOpacity: this._options.defaultOpacity,
      pickable: this._options.defaultPickable,
      hasLayer: false,
      layerCount: 0,
      loading: false,
      error: null,
      status: null,
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._render();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);
    this._checkZoomVisibility();

    // Set up map click handler for pickable layers
    this._setupClickHandler();

    // Auto-load default URL if specified
    if (this._options.loadDefaultUrl && this._options.defaultUrl) {
      const loadStac = () => {
        this._fetchStacItem();
      };
      if (this._map.isStyleLoaded()) {
        setTimeout(loadStac, 100);
      } else {
        this._map.once("idle", loadStac);
      }
    }

    return this._container;
  }

  onRemove(): void {
    this._removeAllLayers();

    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }

    if (this._map && this._mapClickHandler) {
      this._map.off("click", this._mapClickHandler);
      this._mapClickHandler = undefined;
    }

    if (this._activePopup) {
      this._activePopup.remove();
      this._activePopup = undefined;
    }

    if (this._deckOverlay && this._map) {
      try {
        (
          this._map as unknown as { removeControl(c: IControl): void }
        ).removeControl(this._deckOverlay);
      } catch {
        // overlay may already be removed
      }
      this._deckOverlay = undefined;
    }

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position;
  }

  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit("expand", {});
    }
  }

  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit("collapse", {});
    }
  }

  toggle(): void {
    if (this._state.collapsed) this.expand();
    else this.collapse();
  }

  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit("show", {});
    }
  }

  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit("hide", {});
    }
  }

  getState(): StacLayerControlState {
    return { ...this._state };
  }

  update(options: Partial<StacLayerControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
  }

  on(event: StacLayerEvent, handler: StacLayerEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: StacLayerEvent, handler: StacLayerEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  async loadStacUrl(url: string): Promise<void> {
    this._state.stacUrl = url;
    await this._fetchStacItem();
  }

  /**
   * Remove a specific layer by ID, or all layers if no ID is provided.
   */
  removeLayer(id?: string): void {
    if (id) {
      this._removeLayer(id);
    } else {
      this._removeAllLayers();
    }
    this._render();
  }

  /**
   * Get all layer IDs currently managed by this control.
   */
  getLayerIds(): string[] {
    return Array.from(this._cogLayers.keys());
  }

  /**
   * Get the opacity of a specific layer.
   */
  getLayerOpacity(layerId: string): number | null {
    const layer = this._cogLayers.get(layerId);
    if (!layer || !layer.props) return null;
    return layer.props.opacity ?? 1;
  }

  /**
   * Set the opacity of a specific layer.
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this._cogLayers.get(layerId);
    if (!layer || typeof layer.clone !== "function") return;

    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    const updatedLayer = layer.clone({ opacity: clampedOpacity });
    this._cogLayers.set(layerId, updatedLayer);

    if (this._deckOverlay) {
      this._deckOverlay.setProps({
        layers: Array.from(this._cogLayers.values()),
      });
    }

    if (this._map) {
      this._map.triggerRepaint();
    }
  }

  /**
   * Get the visibility of a specific layer (opacity > 0 = visible).
   */
  getLayerVisibility(layerId: string): boolean {
    const opacity = this.getLayerOpacity(layerId);
    return opacity !== null && opacity > 0;
  }

  /**
   * Set the visibility of a specific layer via opacity.
   */
  setLayerVisibility(
    layerId: string,
    visible: boolean,
    storedOpacity: number = 1,
  ): void {
    if (visible) {
      this.setLayerOpacity(layerId, storedOpacity);
    } else {
      this.setLayerOpacity(layerId, 0);
    }
  }

  private _emit(
    event: StacLayerEvent,
    extra?: {
      url?: string;
      error?: string;
      layerId?: string;
      assetKey?: string;
      layerName?: string;
    },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;
    const payload = { type: event, state: this._state, ...extra };
    for (const handler of handlers) {
      handler(payload);
    }
  }

  private _checkZoomVisibility(): void {
    if (!this._map) return;
    const zoom = this._map.getZoom();
    const wasVisible = this._zoomVisible;
    this._zoomVisible =
      zoom >= this._options.minzoom && zoom <= this._options.maxzoom;
    if (wasVisible !== this._zoomVisible) {
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
    container.className = `maplibregl-ctrl maplibre-gl-stac-layer ${this._options.className || ""}`;

    if (this._options.backgroundColor) {
      container.style.background = this._options.backgroundColor;
    }
    if (this._options.borderRadius !== undefined) {
      container.style.borderRadius = `${this._options.borderRadius}px`;
    }
    if (this._options.opacity !== 1) {
      container.style.opacity = String(this._options.opacity);
    }

    return container;
  }

  private _render(): void {
    if (!this._container) return;

    // Save scroll position before clearing content
    const panelEl = this._container.querySelector(
      ".maplibre-gl-stac-layer-panel",
    );
    const scrollTop = panelEl ? panelEl.scrollTop : 0;

    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }

    // Restore scroll position
    if (scrollTop > 0) {
      const newPanelEl = this._container.querySelector(
        ".maplibre-gl-stac-layer-panel",
      );
      if (newPanelEl) {
        newPanelEl.scrollTop = scrollTop;
      }
    }
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    const button = document.createElement("button");
    button.className = `maplibre-gl-stac-layer-button${this._state.hasLayer ? " maplibre-gl-stac-layer-button--active" : ""}`;
    button.innerHTML = STAC_ICON;
    button.title = "STAC Layer Control";
    button.addEventListener("click", () => this.expand());

    this._container.appendChild(button);
    this._button = button;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-stac-layer-panel";
    panel.style.width = `${this._options.panelWidth}px`;
    if (this._options.maxHeight && this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }

    if (this._options.fontSize) {
      panel.style.fontSize = `${this._options.fontSize}px`;
    }
    if (this._options.fontColor) {
      panel.style.color = this._options.fontColor;
    }

    // Header
    const header = document.createElement("div");
    header.className = "maplibre-gl-stac-layer-header";

    const title = document.createElement("span");
    title.className = "maplibre-gl-stac-layer-title";
    title.textContent = "STAC Layer";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-stac-layer-close";
    closeBtn.innerHTML = "×";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // STAC URL input
    const urlGroup = this._createFormGroup("STAC Item URL", "url");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.id = "stac-layer-url";
    urlInput.className = "maplibre-gl-stac-layer-input";
    urlInput.style.color = "#000";
    urlInput.placeholder = "https://example.com/stac-item.json";
    urlInput.value = this._state.stacUrl;
    urlInput.addEventListener("input", () => {
      this._state.stacUrl = urlInput.value;
    });
    urlGroup.appendChild(urlInput);

    // Fetch button
    const fetchBtn = document.createElement("button");
    fetchBtn.className =
      "maplibre-gl-stac-layer-btn maplibre-gl-stac-layer-btn--secondary";
    fetchBtn.textContent = "Fetch STAC";
    fetchBtn.style.marginTop = "8px";
    fetchBtn.disabled = this._state.loading;
    fetchBtn.addEventListener("click", () => this._fetchStacItem());
    urlGroup.appendChild(fetchBtn);

    panel.appendChild(urlGroup);

    // Asset selector (only show if STAC item is loaded)
    if (this._state.stacItem && this._state.assets.length > 0) {
      // RGB Mode toggle
      const modeGroup = document.createElement("div");
      modeGroup.className =
        "maplibre-gl-stac-layer-form-group maplibre-gl-stac-layer-mode-toggle";

      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Layer Mode";
      modeGroup.appendChild(modeLabel);

      const modeButtons = document.createElement("div");
      modeButtons.className = "maplibre-gl-stac-layer-mode-buttons";

      const singleBtn = document.createElement("button");
      singleBtn.type = "button";
      singleBtn.className = `maplibre-gl-stac-layer-mode-btn${!this._state.rgbMode ? " maplibre-gl-stac-layer-mode-btn--active" : ""}`;
      singleBtn.textContent = "Single Band";
      singleBtn.addEventListener("click", () => {
        this._state.rgbMode = false;
        this._render();
      });

      const rgbBtn = document.createElement("button");
      rgbBtn.type = "button";
      rgbBtn.className = `maplibre-gl-stac-layer-mode-btn${this._state.rgbMode ? " maplibre-gl-stac-layer-mode-btn--active" : ""}`;
      rgbBtn.textContent = "RGB Composite";
      rgbBtn.addEventListener("click", () => {
        this._state.rgbMode = true;
        this._render();
      });

      modeButtons.appendChild(singleBtn);
      modeButtons.appendChild(rgbBtn);
      modeGroup.appendChild(modeButtons);
      panel.appendChild(modeGroup);

      if (!this._state.rgbMode) {
        // Single band mode - asset selector
        const assetGroup = this._createFormGroup("Select Asset", "asset");
        const assetSelect = document.createElement("select");
        assetSelect.id = "stac-layer-asset";
        assetSelect.className = "maplibre-gl-stac-layer-select";
        assetSelect.style.color = "#000";

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select an asset --";
        assetSelect.appendChild(defaultOption);

        for (const asset of this._state.assets) {
          const option = document.createElement("option");
          option.value = asset.key;
          // Show data type in dropdown if available
          const dataTypeLabel = asset.dataType ? ` (${asset.dataType})` : "";
          option.textContent = (asset.title || asset.key) + dataTypeLabel;
          option.selected = this._state.selectedAsset === asset.key;
          assetSelect.appendChild(option);
        }

        assetSelect.addEventListener("change", () => {
          this._state.selectedAsset = assetSelect.value || null;
          // Auto-set rescale based on data type
          this._autoSetRescale();
          this._render();
        });

        assetGroup.appendChild(assetSelect);
        panel.appendChild(assetGroup);
      } else {
        // RGB mode - 3 band selectors
        const rgbGroup = this._createFormGroup("RGB Bands", "rgb");
        const channels = ["Red", "Green", "Blue"] as const;

        for (let i = 0; i < 3; i++) {
          const row = document.createElement("div");
          row.className = "maplibre-gl-stac-layer-rgb-row";

          const channelLabel = document.createElement("span");
          channelLabel.className = "maplibre-gl-stac-layer-rgb-label";
          channelLabel.textContent = channels[i];
          channelLabel.style.color =
            i === 0 ? "#d32f2f" : i === 1 ? "#388e3c" : "#1976d2";
          row.appendChild(channelLabel);

          const select = document.createElement("select");
          select.className =
            "maplibre-gl-stac-layer-select maplibre-gl-stac-layer-rgb-select";
          select.style.color = "#000";

          const defaultOpt = document.createElement("option");
          defaultOpt.value = "";
          defaultOpt.textContent = "-- Select --";
          select.appendChild(defaultOpt);

          for (const asset of this._state.assets) {
            const opt = document.createElement("option");
            opt.value = asset.key;
            const dataTypeLabel = asset.dataType ? ` (${asset.dataType})` : "";
            opt.textContent = (asset.title || asset.key) + dataTypeLabel;
            opt.selected = this._state.rgbAssets[i] === asset.key;
            select.appendChild(opt);
          }

          const idx = i;
          select.addEventListener("change", () => {
            this._state.rgbAssets[idx] = select.value || null;
            // Auto-set rescale based on first selected RGB band
            if (idx === 0 && select.value) {
              const asset = this._state.assets.find(
                (a) => a.key === select.value,
              );
              if (asset) {
                this._state.selectedAsset = asset.key;
                this._autoSetRescale();
                this._state.selectedAsset = null;
              }
            }
            this._render();
          });

          row.appendChild(select);
          rgbGroup.appendChild(row);
        }

        panel.appendChild(rgbGroup);
      }

      // Colormap selector (only for single band mode)
      if (!this._state.rgbMode) {
        const colormapGroup = this._createFormGroup("Colormap", "colormap");
        const colormapSelect = document.createElement("select");
        colormapSelect.id = "stac-layer-colormap";
        colormapSelect.className = "maplibre-gl-stac-layer-select";
        colormapSelect.style.color = "#000";

        const noneOption = document.createElement("option");
        noneOption.value = "none";
        noneOption.textContent = "None (Original)";
        noneOption.selected = this._state.colormap === "none";
        colormapSelect.appendChild(noneOption);

        for (const name of COLORMAP_NAMES) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          opt.selected = this._state.colormap === name;
          colormapSelect.appendChild(opt);
        }

        colormapSelect.addEventListener("change", () => {
          this._state.colormap = colormapSelect.value as ColormapName | "none";
          this._updateColormapPreview();
          this._updateRescaleAndColormap();
        });

        colormapGroup.appendChild(colormapSelect);

        // Colormap preview
        const colormapPreview = document.createElement("div");
        colormapPreview.className = "maplibre-gl-stac-layer-colormap-preview";
        this._colormapPreview = colormapPreview;
        colormapGroup.appendChild(colormapPreview);

        panel.appendChild(colormapGroup);
        this._updateColormapPreview();
      }

      // Rescale inputs
      const rescaleGroup = this._createFormGroup("Rescale Range", "rescale");
      const rescaleRow = document.createElement("div");
      rescaleRow.className = "maplibre-gl-stac-layer-rescale-row";

      const minInput = document.createElement("input");
      minInput.type = "number";
      minInput.className =
        "maplibre-gl-stac-layer-input maplibre-gl-stac-layer-input--half";
      minInput.style.color = "#000";
      minInput.placeholder = "Min";
      minInput.value = String(this._state.rescaleMin);
      minInput.addEventListener("input", () => {
        this._state.rescaleMin = Number(minInput.value) || 0;
      });
      minInput.addEventListener("change", () => {
        this._updateRescaleAndColormap();
      });

      const maxInput = document.createElement("input");
      maxInput.type = "number";
      maxInput.className =
        "maplibre-gl-stac-layer-input maplibre-gl-stac-layer-input--half";
      maxInput.style.color = "#000";
      maxInput.placeholder = "Max";
      maxInput.value = String(this._state.rescaleMax);
      maxInput.addEventListener("input", () => {
        this._state.rescaleMax = Number(maxInput.value) || 255;
      });
      maxInput.addEventListener("change", () => {
        this._updateRescaleAndColormap();
      });

      rescaleRow.appendChild(minInput);
      rescaleRow.appendChild(maxInput);
      rescaleGroup.appendChild(rescaleRow);
      panel.appendChild(rescaleGroup);

      // Opacity slider
      const opacityGroup = this._createFormGroup("Opacity", "opacity");
      const sliderRow = document.createElement("div");
      sliderRow.className = "maplibre-gl-stac-layer-slider-row";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "maplibre-gl-stac-layer-slider";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(Math.round(this._state.layerOpacity * 100));
      const sliderValue = document.createElement("span");
      sliderValue.className = "maplibre-gl-stac-layer-slider-value";
      sliderValue.textContent = `${Math.round(this._state.layerOpacity * 100)}%`;
      slider.addEventListener("input", () => {
        const pct = Number(slider.value);
        this._state.layerOpacity = pct / 100;
        sliderValue.textContent = `${pct}%`;
        this._updateOpacity();
      });
      sliderRow.appendChild(slider);
      sliderRow.appendChild(sliderValue);
      opacityGroup.appendChild(sliderRow);
      panel.appendChild(opacityGroup);

      // Layer name input
      const layerNameGroup = this._createFormGroup("Layer Name", "layer-name");
      const layerNameInput = document.createElement("input");
      layerNameInput.type = "text";
      layerNameInput.className = "maplibre-gl-stac-layer-input";
      layerNameInput.style.color = "#000";
      layerNameInput.placeholder = "Optional custom layer name";
      layerNameInput.value = this._state.layerName;
      layerNameInput.addEventListener("input", () => {
        this._state.layerName = layerNameInput.value;
      });
      layerNameGroup.appendChild(layerNameInput);
      panel.appendChild(layerNameGroup);

      // Pickable checkbox
      const pickableGroup = document.createElement("div");
      pickableGroup.className =
        "maplibre-gl-stac-layer-form-group maplibre-gl-stac-layer-checkbox-group";
      const pickableLabel = document.createElement("label");
      pickableLabel.className = "maplibre-gl-stac-layer-checkbox-label";
      const pickableCheckbox = document.createElement("input");
      pickableCheckbox.type = "checkbox";
      pickableCheckbox.className = "maplibre-gl-stac-layer-checkbox";
      pickableCheckbox.checked = this._state.pickable;
      pickableCheckbox.addEventListener("change", () => {
        this._state.pickable = pickableCheckbox.checked;
      });
      pickableLabel.appendChild(pickableCheckbox);
      const pickableLabelText = document.createElement("span");
      pickableLabelText.textContent = "Pickable (click for info)";
      pickableLabel.appendChild(pickableLabelText);
      pickableGroup.appendChild(pickableLabel);
      panel.appendChild(pickableGroup);

      // Add Layer button
      const btns = document.createElement("div");
      btns.className = "maplibre-gl-stac-layer-buttons";

      const addBtn = document.createElement("button");
      addBtn.className =
        "maplibre-gl-stac-layer-btn maplibre-gl-stac-layer-btn--primary";
      addBtn.textContent = "Add Layer";

      // Check if button should be enabled
      const canAdd = this._state.rgbMode
        ? this._state.rgbAssets.every((a) => a !== null)
        : this._state.selectedAsset !== null;
      addBtn.disabled = this._state.loading || !canAdd;

      addBtn.addEventListener("click", () => this._addLayer());
      btns.appendChild(addBtn);

      panel.appendChild(btns);
    }

    // Status/error area
    if (this._state.loading) {
      this._appendStatus(panel, "Loading...", "info");
    } else if (this._state.error) {
      this._appendStatus(panel, this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(panel, this._state.status, "success");
    }

    // STAC Item info
    if (this._state.stacItem) {
      const infoDiv = document.createElement("div");
      infoDiv.className = "maplibre-gl-stac-layer-info";
      infoDiv.innerHTML = `
        <div class="maplibre-gl-stac-layer-info-title">
          <strong>ID:</strong> ${this._state.stacItem.id}
        </div>
        <div><strong>Date:</strong> ${this._state.stacItem.properties?.datetime || "N/A"}</div>
        <div><strong>Assets:</strong> ${this._state.assets.length} available</div>
      `;
      panel.appendChild(infoDiv);
    }

    // Layer list
    if (this._cogLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-stac-layer-list";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-stac-layer-list-header";
      listHeader.textContent = `Layers (${this._cogLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [layerId] of this._cogLayers) {
        const item = document.createElement("div");
        item.className = "maplibre-gl-stac-layer-list-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-stac-layer-list-label";
        const props = this._cogLayerPropsMap.get(layerId);
        const customName = props?._layerName as string | undefined;
        label.textContent = customName || layerId;
        label.title = layerId;
        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-stac-layer-list-remove";
        removeBtn.innerHTML = "×";
        removeBtn.title = "Remove layer";
        removeBtn.addEventListener("click", () => {
          this._removeLayer(layerId);
          this._render();
        });
        item.appendChild(removeBtn);

        listContainer.appendChild(item);
      }

      panel.appendChild(listContainer);
    }

    this._container.appendChild(panel);
    this._panel = panel;
    this._button = undefined;
  }

  private _createFormGroup(labelText: string, id: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "maplibre-gl-stac-layer-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `stac-layer-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    panel: HTMLElement,
    message: string,
    type: "info" | "error" | "success",
  ): void {
    const status = document.createElement("div");
    status.className = `maplibre-gl-stac-layer-status maplibre-gl-stac-layer-status--${type}`;
    status.textContent = message;
    panel.appendChild(status);
  }

  /**
   * Auto-set rescale values based on the selected asset's data type.
   */
  private _autoSetRescale(): void {
    if (!this._state.selectedAsset) return;

    const asset = this._state.assets.find(
      (a) => a.key === this._state.selectedAsset,
    );
    if (!asset) return;

    const dataType = asset.dataType?.toLowerCase();

    if (dataType === "uint16") {
      // Sentinel-2, Landsat, etc. - typical reflectance range 0-10000
      this._state.rescaleMin = 0;
      this._state.rescaleMax = 10000;
    } else if (dataType === "int16") {
      // Some elevation data, signed 16-bit
      this._state.rescaleMin = -32768;
      this._state.rescaleMax = 32767;
    } else if (dataType === "float32" || dataType === "float64") {
      // Float data - assume normalized 0-1 or use common ranges
      this._state.rescaleMin = 0;
      this._state.rescaleMax = 1;
    } else if (dataType === "uint8") {
      // Standard 8-bit imagery
      this._state.rescaleMin = 0;
      this._state.rescaleMax = 255;
    }
    // For unknown types, keep existing values
  }

  private _updateColormapPreview(): void {
    const preview = this._colormapPreview;
    if (!preview) return;

    if (this._state.colormap === "none") {
      preview.style.display = "none";
      return;
    }

    const stops = getColormap(this._state.colormap as ColormapName);
    if (stops && stops.length > 0) {
      // Extract color values from ColorStop objects
      const gradient = stops.map((s) => s.color).join(", ");
      preview.style.background = `linear-gradient(to right, ${gradient})`;
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  }

  private async _fetchStacItem(): Promise<void> {
    if (!this._state.stacUrl) {
      this._state.error = "Please enter a STAC item URL.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._state.stacItem = null;
    this._state.assets = [];
    this._state.selectedAsset = null;
    this._render();

    try {
      const response = await fetch(this._state.stacUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch: ${response.status} ${response.statusText}`,
        );
      }

      // Get raw text first to preserve asset key order from JSON source
      const rawText = await response.text();
      const stacItem = JSON.parse(rawText);

      // Validate it's a STAC item
      if (stacItem.type !== "Feature" || !stacItem.assets) {
        throw new Error(
          "Invalid STAC item: missing 'type: Feature' or 'assets'",
        );
      }

      this._state.stacItem = stacItem;

      // Extract asset keys in original JSON order using regex
      // This preserves the order as it appears in the source JSON
      const assetKeysInOrder: string[] = [];
      const assetsMatch = rawText.match(
        /"assets"\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/,
      );
      if (assetsMatch) {
        const assetsBlock = assetsMatch[1];
        const keyMatches = assetsBlock.matchAll(/"([^"]+)"\s*:\s*\{/g);
        for (const match of keyMatches) {
          assetKeysInOrder.push(match[1]);
        }
      }

      // Fall back to Object.keys if regex didn't work
      const keysToIterate =
        assetKeysInOrder.length > 0
          ? assetKeysInOrder
          : Object.keys(stacItem.assets);

      // Extract COG assets in original order
      const assets: StacAssetInfo[] = [];
      for (const key of keysToIterate) {
        const asset = stacItem.assets[key];
        if (!asset) continue;
        const assetObj = asset as {
          href: string;
          type?: string;
          title?: string;
          data_type?: string;
          nodata?: number;
          "raster:bands"?: Array<{
            data_type?: string;
            nodata?: number;
            scale?: number;
            offset?: number;
          }>;
          "eo:bands"?: Array<{
            name?: string;
            common_name?: string;
            center_wavelength?: number;
          }>;
        };
        // Filter for COG/GeoTIFF assets
        if (
          assetObj.type?.includes("geotiff") ||
          assetObj.type?.includes("image/tiff") ||
          assetObj.href?.endsWith(".tif") ||
          assetObj.href?.endsWith(".tiff")
        ) {
          // Extract raster:bands metadata if available
          const rasterBand = assetObj["raster:bands"]?.[0];
          // Extract eo:bands metadata for wavelength-based sorting
          const eoBand = assetObj["eo:bands"]?.[0];
          assets.push({
            key,
            href: assetObj.href,
            type: assetObj.type || "image/tiff",
            title: assetObj.title || key,
            dataType: rasterBand?.data_type || assetObj.data_type,
            nodata: rasterBand?.nodata ?? assetObj.nodata,
            scale: rasterBand?.scale,
            offset: rasterBand?.offset,
            centerWavelength: eoBand?.center_wavelength,
            commonName: eoBand?.common_name,
          });
        }
      }

      // Sort assets by center wavelength (spectral order) if available
      // Assets without wavelength go to the end
      assets.sort((a, b) => {
        // Both have wavelength - sort by wavelength
        if (
          a.centerWavelength !== undefined &&
          b.centerWavelength !== undefined
        ) {
          return a.centerWavelength - b.centerWavelength;
        }
        // Only a has wavelength - a comes first
        if (a.centerWavelength !== undefined) return -1;
        // Only b has wavelength - b comes first
        if (b.centerWavelength !== undefined) return 1;
        // Neither has wavelength - keep original order (by key)
        return 0;
      });

      this._state.assets = assets;
      this._state.loading = false;
      this._state.status = `Found ${assets.length} COG asset(s)`;
      this._emit("stacload", { url: this._state.stacUrl });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load STAC: ${err instanceof Error ? err.message : String(err)}`;
      this._emit("error", { error: this._state.error });
    }

    this._render();
  }

  private async _ensureOverlay(): Promise<void> {
    if (this._deckOverlay) return;
    if (!this._map) return;

    const { MapboxOverlay } = await import("@deck.gl/mapbox");
    this._deckOverlay = new MapboxOverlay({
      interleaved: !!this._options.beforeId,
      layers: [],
    });
    (this._map as unknown as { addControl(c: IControl): void }).addControl(
      this._deckOverlay,
    );
  }

  private _setupClickHandler(): void {
    if (!this._map || this._mapClickHandler) return;
    const map = this._map;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._mapClickHandler = (e: any) => {
      if (!this._state.pickable || this._cogLayers.size === 0) return;

      if (this._activePopup) {
        this._activePopup.remove();
      }

      const { lngLat } = e;
      const layerIds = Array.from(this._cogLayers.keys());
      const props = this._cogLayerPropsMap.get(layerIds[0]);

      let html = '<div class="maplibre-gl-stac-layer-popup">';
      html += '<table class="maplibre-gl-stac-layer-popup-table">';
      html += `<tr><td><strong>Layers</strong></td><td>${layerIds.length} STAC layer(s)</td></tr>`;
      html += `<tr><td><strong>Lng</strong></td><td>${lngLat.lng.toFixed(6)}</td></tr>`;
      html += `<tr><td><strong>Lat</strong></td><td>${lngLat.lat.toFixed(6)}</td></tr>`;
      if (props) {
        html += `<tr><td><strong>Rescale</strong></td><td>${props._rescaleMin} - ${props._rescaleMax}</td></tr>`;
        if (props._colormap && props._colormap !== "none") {
          html += `<tr><td><strong>Colormap</strong></td><td>${props._colormap}</td></tr>`;
        }
      }
      html += "</table></div>";

      this._activePopup = new maplibregl.Popup({
        closeButton: true,
        maxWidth: "280px",
      })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map);

      const popupEl = this._activePopup.getElement();
      if (popupEl) {
        popupEl.style.zIndex = "1000";
      }
    };
    map.on("click", this._mapClickHandler);
  }

  private async _addLayer(): Promise<void> {
    if (!this._map) {
      this._state.error = "Map not available.";
      this._render();
      return;
    }

    // Handle RGB mode
    if (this._state.rgbMode) {
      const [r, g, b] = this._state.rgbAssets;
      if (!r || !g || !b) {
        this._state.error = "Please select assets for all RGB bands.";
        this._render();
        return;
      }

      const rAsset = this._state.assets.find((a) => a.key === r);
      const gAsset = this._state.assets.find((a) => a.key === g);
      const bAsset = this._state.assets.find((a) => a.key === b);

      if (!rAsset || !gAsset || !bAsset) {
        this._state.error = "One or more selected assets not found.";
        this._render();
        return;
      }

      this._state.loading = true;
      this._state.error = null;
      this._state.status = null;
      this._render();

      try {
        await this._ensureOverlay();

        const { COGLayer } = await import("@developmentseed/deck.gl-geotiff");
        const { fromUrl } = await import("geotiff");
        this._patchCOGLayer(COGLayer);

        // For RGB composite, we create a custom layer with multi-band getTileData
        const layerId = `stac-${this._state.stacItem?.id || "layer"}-rgb-${this._layerCounter++}`;

        // Pre-load all 3 GeoTIFFs for band access
        const [rTiff, gTiff, bTiff] = await Promise.all([
          fromUrl(rAsset.href),
          fromUrl(gAsset.href),
          fromUrl(bAsset.href),
        ]);

        // Pre-load all images (overviews) from each TIFF
        const rImageCount = await rTiff.getImageCount();
        const gImageCount = await gTiff.getImageCount();
        const bImageCount = await bTiff.getImageCount();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rImages: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gImages: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bImages: any[] = [];

        for (let i = 0; i < rImageCount; i++) {
          rImages.push(await rTiff.getImage(i));
        }
        for (let i = 0; i < gImageCount; i++) {
          gImages.push(await gTiff.getImage(i));
        }
        for (let i = 0; i < bImageCount; i++) {
          bImages.push(await bTiff.getImage(i));
        }

        const rescaleMin = this._state.rescaleMin;
        const rescaleMax = this._state.rescaleMax;
        const rescaleRange = rescaleMax - rescaleMin;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layerProps: Record<string, any> = {
          id: layerId,
          geotiff: rTiff, // Use red band as the primary for tile structure
          opacity: this._state.layerOpacity,
          pickable: this._state.pickable,
          _rescaleMin: rescaleMin,
          _rescaleMax: rescaleMax,
          _isRgb: true,
          _preRescaled: true, // Mark as pre-rescaled to skip shader processing
          // Custom getTileData to load all 3 bands and combine into RGB
          getTileData: async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rImage: any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options: any,
          ) => {
            const { window: tileWindow, pool, device } = options;

            // Find matching overview images from G and B bands by dimensions
            const rWidth = rImage.getWidth();
            const rHeight = rImage.getHeight();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let gImage: any = gImages[0];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let bImage: any = bImages[0];

            // Find the image with matching dimensions for each band
            for (const img of gImages) {
              if (img.getWidth() === rWidth && img.getHeight() === rHeight) {
                gImage = img;
                break;
              }
            }
            for (const img of bImages) {
              if (img.getWidth() === rWidth && img.getHeight() === rHeight) {
                bImage = img;
                break;
              }
            }

            const readOptions = {
              window: tileWindow,
              pool,
              interleave: false,
            };

            const [rData, gData, bData] = await Promise.all([
              rImage.readRasters(readOptions),
              gImage.readRasters(readOptions),
              bImage.readRasters(readOptions),
            ]);

            const width = rData.width;
            const height = rData.height;
            const rBand = rData[0] as Float32Array | Uint8Array | Uint16Array;
            const gBand = gData[0] as Float32Array | Uint8Array | Uint16Array;
            const bBand = bData[0] as Float32Array | Uint8Array | Uint16Array;

            // Create RGBA data with nodata handling
            const rgbaData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < width * height; i++) {
              const rRaw = rBand[i];
              const gRaw = gBand[i];
              const bRaw = bBand[i];

              // Handle nodata: if all bands are 0, treat as transparent
              if (rRaw === 0 && gRaw === 0 && bRaw === 0) {
                rgbaData[i * 4] = 0;
                rgbaData[i * 4 + 1] = 0;
                rgbaData[i * 4 + 2] = 0;
                rgbaData[i * 4 + 3] = 0; // Transparent
              } else {
                // Normalize values to 0-255 range using rescale params
                const rVal = Math.max(
                  0,
                  Math.min(255, ((rRaw - rescaleMin) / rescaleRange) * 255),
                );
                const gVal = Math.max(
                  0,
                  Math.min(255, ((gRaw - rescaleMin) / rescaleRange) * 255),
                );
                const bVal = Math.max(
                  0,
                  Math.min(255, ((bRaw - rescaleMin) / rescaleRange) * 255),
                );
                rgbaData[i * 4] = rVal;
                rgbaData[i * 4 + 1] = gVal;
                rgbaData[i * 4 + 2] = bVal;
                rgbaData[i * 4 + 3] = 255;
              }
            }

            // Create WebGL texture properly
            const tex = device.createTexture({
              data: rgbaData,
              format: "rgba8unorm",
              width,
              height,
              sampler: { magFilter: "nearest", minFilter: "nearest" },
            });

            return {
              texture: tex,
              width,
              height,
              _preRescaled: true,
            };
          },
        };

        // Add custom geoKeysParser for better projection support
        const geoKeysParser = await this._buildGeoKeysParser();
        if (geoKeysParser) {
          layerProps.geoKeysParser = geoKeysParser;
        }

        // Store custom layer name if provided
        const customNameRgb = this._state.layerName?.trim();
        if (customNameRgb) {
          layerProps._layerName = customNameRgb;
        }

        this._cogLayerPropsMap.set(layerId, layerProps);
        const newLayer = new COGLayer(layerProps);
        this._cogLayers.set(layerId, newLayer);
        this._deckOverlay.setProps({
          layers: Array.from(this._cogLayers.values()),
        });

        // Fit to bounds if available
        if (this._state.stacItem?.bbox) {
          const [west, south, east, north] = this._state.stacItem.bbox;
          this._map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 50, duration: 1000 },
          );
        }

        this._state.hasLayer = this._cogLayers.size > 0;
        this._state.layerCount = this._cogLayers.size;
        this._state.loading = false;
        this._state.status = `Added RGB layer: ${r}, ${g}, ${b}`;
        this._state.layerName = "";
        this._render();
        this._emit("layeradd", {
          layerId,
          assetKey: `${r},${g},${b}`,
          url: rAsset.href,
          layerName: customNameRgb || undefined,
        });
      } catch (err) {
        this._state.loading = false;
        this._state.error = `Failed to add RGB layer: ${err instanceof Error ? err.message : String(err)}`;
        this._render();
        this._emit("error", { error: this._state.error });
      }
      return;
    }

    // Single band mode
    if (!this._state.selectedAsset) {
      this._state.error = "Please select an asset.";
      this._render();
      return;
    }

    const asset = this._state.assets.find(
      (a) => a.key === this._state.selectedAsset,
    );
    if (!asset) {
      this._state.error = "Selected asset not found.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      await this._ensureOverlay();

      const { COGLayer } = await import("@developmentseed/deck.gl-geotiff");
      this._patchCOGLayer(COGLayer);

      const layerId = `stac-${this._state.stacItem?.id || "layer"}-${asset.key}-${this._layerCounter++}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layerProps: Record<string, any> = {
        id: layerId,
        geotiff: asset.href,
        opacity: this._state.layerOpacity,
        pickable: this._state.pickable,
        _rescaleMin: this._state.rescaleMin,
        _rescaleMax: this._state.rescaleMax,
        _colormap: this._state.colormap,
      };

      // Store custom layer name if provided
      const customName = this._state.layerName?.trim();
      if (customName) {
        layerProps._layerName = customName;
      }

      // Add custom geoKeysParser for better projection support
      const geoKeysParser = await this._buildGeoKeysParser();
      if (geoKeysParser) {
        layerProps.geoKeysParser = geoKeysParser;
      }

      this._cogLayerPropsMap.set(layerId, layerProps);
      const newLayer = new COGLayer(layerProps);
      this._cogLayers.set(layerId, newLayer);
      this._deckOverlay.setProps({
        layers: Array.from(this._cogLayers.values()),
      });

      // Fit to bounds if available
      if (this._state.stacItem?.bbox) {
        const [west, south, east, north] = this._state.stacItem.bbox;
        this._map.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 50, duration: 1000 },
        );
      }

      this._state.hasLayer = this._cogLayers.size > 0;
      this._state.layerCount = this._cogLayers.size;
      this._state.loading = false;
      this._state.status = `Added layer: ${asset.title || asset.key}`;
      this._state.layerName = "";
      this._render();
      this._emit("layeradd", {
        layerId,
        assetKey: asset.key,
        url: asset.href,
        layerName: customName || undefined,
      });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to add layer: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
  }

  private _updateOpacity(): void {
    if (!this._deckOverlay) return;

    for (const [, props] of this._cogLayerPropsMap) {
      props.opacity = this._state.layerOpacity;
    }

    // Rebuild layers with new opacity
    const layers = Array.from(this._cogLayers.entries()).map(([id]) => {
      const props = this._cogLayerPropsMap.get(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer = this._cogLayers.get(id) as any;
      return layer.clone(props);
    });

    this._deckOverlay.setProps({ layers });
  }

  private _updateRescaleAndColormap(): void {
    if (!this._deckOverlay || this._cogLayers.size === 0) return;

    // Update props for all layers
    for (const [, props] of this._cogLayerPropsMap) {
      // Skip RGB layers (they handle rescale differently)
      if (props._isRgb) continue;
      props._rescaleMin = this._state.rescaleMin;
      props._rescaleMax = this._state.rescaleMax;
      props._colormap = this._state.colormap;
    }

    // Rebuild layers with updated props
    const layers = Array.from(this._cogLayers.entries()).map(([id]) => {
      const props = this._cogLayerPropsMap.get(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer = this._cogLayers.get(id) as any;
      return layer.clone(props);
    });

    this._deckOverlay.setProps({ layers });
  }

  private _removeLayer(layerId: string): void {
    if (!this._map) return;

    this._cogLayers.delete(layerId);
    this._cogLayerPropsMap.delete(layerId);

    if (this._deckOverlay) {
      this._deckOverlay.setProps({
        layers: Array.from(this._cogLayers.values()),
      });
    }

    this._state.hasLayer = this._cogLayers.size > 0;
    this._state.layerCount = this._cogLayers.size;
    this._state.status = null;
    this._state.error = null;
    this._emit("layerremove", { layerId });
  }

  private _removeAllLayers(): void {
    for (const [layerId] of this._cogLayers) {
      this._removeLayer(layerId);
    }
  }

  /**
   * Patch COGLayer to handle grayscale and float GeoTIFFs with colormap support.
   * The upstream library has limited support for these formats.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _patchCOGLayer(COGLayerClass: any): void {
    // Guard: only patch once
    if (COGLayerClass.__stacPatched) return;
    COGLayerClass.__stacPatched = true;

    // Patch for opacity propagation to sublayers
    const originalRenderSubLayers = COGLayerClass.prototype._renderSubLayers;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    COGLayerClass.prototype._renderSubLayers = function (...args: any[]) {
      const layers = originalRenderSubLayers.apply(this, args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opacity = (this as any).props.opacity;
      if (opacity === undefined || opacity === null) return layers;
      return applyOpacity(layers, Math.max(0, Math.min(1, opacity)));
    };

    COGLayerClass.prototype._parseGeoTIFF = async function () {
      // Always use custom handling to properly support uint16/float data
      // The original library has issues with single-band uint16 textures
      // Custom handling for grayscale/float/uint16 data
      const { fromUrl } = await import("geotiff");
      const { parseCOGTileMatrixSet, texture } =
        await import("@developmentseed/deck.gl-geotiff");
      const { CreateTexture, FilterNoDataVal, Colormap } =
        await import("@developmentseed/deck.gl-raster/gpu-modules");
      const proj4Module = await import("proj4");
      const proj4Fn = proj4Module.default || proj4Module;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geotiffInput = (this as any).props.geotiff;
      const geotiff =
        typeof geotiffInput === "string"
          ? await fromUrl(geotiffInput)
          : geotiffInput;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geoKeysParser = (this as any).props.geoKeysParser;

      let metadata;
      try {
        metadata = await parseCOGTileMatrixSet(geotiff, geoKeysParser);
      } catch {
        // If parsing fails, try with undefined geoKeysParser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata = await parseCOGTileMatrixSet(geotiff, undefined as any);
      }

      const image = await geotiff.getImage();
      const imageCount = await geotiff.getImageCount();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const images: any[] = [];
      for (let i = 0; i < imageCount; i++) {
        images.push(await geotiff.getImage(i));
      }

      const sourceProjection = geoKeysParser
        ? await geoKeysParser(image.getGeoKeys())
        : null;
      let forwardReproject = null;
      let inverseReproject = null;

      if (sourceProjection && typeof proj4Fn === "function") {
        const converter = proj4Fn(sourceProjection.def, "EPSG:4326");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forwardReproject = (x: number, y: number) =>
          converter.forward([x, y], false as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inverseReproject = (x: number, y: number) =>
          converter.inverse([x, y], false as any);

        // Compute geographic bounds for fitBounds callback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((this as any).props.onGeoTIFFLoad) {
          const bbox = image.getBoundingBox();
          const corners = [
            converter.forward([bbox[0], bbox[1]]),
            converter.forward([bbox[2], bbox[1]]),
            converter.forward([bbox[2], bbox[3]]),
            converter.forward([bbox[0], bbox[3]]),
          ];
          const lons = corners.map((c: number[]) => c[0]);
          const lats = corners.map((c: number[]) => c[1]);
          const geographicBounds = {
            west: Math.min(...lons),
            south: Math.min(...lats),
            east: Math.max(...lons),
            north: Math.max(...lats),
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any).props.onGeoTIFFLoad(geotiff, {
            projection: sourceProjection,
            geographicBounds,
          });
        }
      }

      const ifd = image.getFileDirectory();
      const { BitsPerSample, SampleFormat, SamplesPerPixel, GDAL_NODATA } = ifd;

      // Parse GDAL_NODATA tag
      let noDataVal: number | null = null;
      if (GDAL_NODATA) {
        const ndStr =
          GDAL_NODATA[GDAL_NODATA.length - 1] === "\x00"
            ? GDAL_NODATA.slice(0, -1)
            : GDAL_NODATA;
        if (ndStr.length > 0) noDataVal = parseFloat(ndStr);
      }

      // Get rescale values from props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selfForTile = this as any;
      const rescaleMin = selfForTile.props._rescaleMin ?? 0;
      const rescaleMax = selfForTile.props._rescaleMax ?? 10000;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultGetTileData = async (geotiffImage: any, options: any) => {
        const { device } = options;
        const rasterData = await geotiffImage.readRasters({
          ...options,
          interleave: true,
        });

        // Handle TypedArrays and regular arrays
        const bitsPerSample =
          typeof BitsPerSample === "object" && BitsPerSample?.[0] !== undefined
            ? BitsPerSample[0]
            : BitsPerSample;
        const pixelCount = rasterData.width * rasterData.height;

        // For single-band uint16 data, convert to RGBA8 with rescaling applied
        // This ensures universal WebGL compatibility
        if (SamplesPerPixel === 1 && bitsPerSample === 16) {
          const rgba = new Uint8ClampedArray(pixelCount * 4);
          const range = rescaleMax - rescaleMin;

          // Check if a colormap is selected - apply it directly to preserve nodata transparency
          const cmapName = selfForTile.props._colormap;
          let colormapStops: ColorStop[] | null = null;
          if (cmapName && cmapName !== "none") {
            colormapStops = getColormap(cmapName);
          }

          for (let i = 0; i < pixelCount; i++) {
            const rawVal = rasterData[i];
            // Handle nodata (typically 0 for Sentinel-2)
            if (rawVal === 0 || rawVal === noDataVal) {
              rgba[i * 4] = 0;
              rgba[i * 4 + 1] = 0;
              rgba[i * 4 + 2] = 0;
              rgba[i * 4 + 3] = 0; // Transparent - preserved even with colormap
            } else {
              // Rescale to 0-1 range for colormap lookup, or 0-255 for grayscale
              const normalizedFloat = Math.max(
                0,
                Math.min(1, (rawVal - rescaleMin) / range),
              );

              if (colormapStops) {
                // Apply colormap - interpolate between stops
                const color = interpolateColormap(
                  colormapStops,
                  normalizedFloat,
                );
                rgba[i * 4] = color[0];
                rgba[i * 4 + 1] = color[1];
                rgba[i * 4 + 2] = color[2];
                rgba[i * 4 + 3] = 255;
              } else {
                // Grayscale
                const gray = Math.round(normalizedFloat * 255);
                rgba[i * 4] = gray;
                rgba[i * 4 + 1] = gray;
                rgba[i * 4 + 2] = gray;
                rgba[i * 4 + 3] = 255;
              }
            }
          }

          const tex = device.createTexture({
            data: rgba,
            format: "rgba8unorm",
            width: rasterData.width,
            height: rasterData.height,
            sampler: { magFilter: "nearest", minFilter: "nearest" },
          });

          return {
            texture: tex,
            height: rasterData.height,
            width: rasterData.width,
            _preRescaled: true, // Flag that rescaling was done in getTileData
            _colormapApplied: !!colormapStops, // Flag that colormap was applied in getTileData
          };
        }

        // For 3-band data, expand to RGBA with nodata handling
        if (SamplesPerPixel === 3) {
          const rgba = new Uint8ClampedArray(pixelCount * 4);
          for (let i = 0; i < pixelCount; i++) {
            const r = rasterData[i * 3];
            const g = rasterData[i * 3 + 1];
            const b = rasterData[i * 3 + 2];
            // Handle nodata: if all bands are 0, treat as transparent
            if (r === 0 && g === 0 && b === 0) {
              rgba[i * 4] = 0;
              rgba[i * 4 + 1] = 0;
              rgba[i * 4 + 2] = 0;
              rgba[i * 4 + 3] = 0; // Transparent
            } else {
              rgba[i * 4] = r;
              rgba[i * 4 + 1] = g;
              rgba[i * 4 + 2] = b;
              rgba[i * 4 + 3] = 255;
            }
          }

          const tex = device.createTexture({
            data: rgba,
            format: "rgba8unorm",
            width: rasterData.width,
            height: rasterData.height,
            sampler: { magFilter: "nearest", minFilter: "nearest" },
          });

          return {
            texture: tex,
            height: rasterData.height,
            width: rasterData.width,
            _preRescaled: true, // rgba8unorm is already normalized, skip RescaleFloat
          };
        }

        // Default: use original texture format inference
        const textureFormat = texture.inferTextureFormat(
          SamplesPerPixel,
          BitsPerSample,
          SampleFormat,
        );

        const tex = device.createTexture({
          data: rasterData,
          format: textureFormat,
          width: rasterData.width,
          height: rasterData.height,
          sampler: { magFilter: "nearest", minFilter: "nearest" },
        });

        return {
          texture: tex,
          height: rasterData.height,
          width: rasterData.width,
        };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = this as any;
      // Cache colormap texture to avoid recreating per tile
      let cachedCmapName: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cachedCmapTexture: any = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultRenderTile = (tileData: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pipeline: any[] = [
          {
            module: CreateTexture,
            props: { textureName: tileData.texture },
          },
        ];

        // Skip nodata filter and rescaling if data was pre-processed in getTileData
        if (!tileData._preRescaled) {
          // Filter nodata pixels
          if (noDataVal !== null) {
            pipeline.push({
              module: FilterNoDataVal,
              props: { value: noDataVal },
            });
          }

          // Rescale float values to [0,1] for visualization
          const rescaleMin = self.props._rescaleMin ?? 0;
          const rescaleMax = self.props._rescaleMax ?? 255;
          pipeline.push({
            module: RescaleFloat,
            props: {
              minVal: rescaleMin,
              maxVal: rescaleMax,
              isSingleBand: SamplesPerPixel === 1 ? 1.0 : 0.0,
            },
          });
        }

        // Apply colormap if selected (works on normalized 0-1 data)
        // Skip if colormap was already applied in getTileData (for uint16 data with nodata preservation)
        const cmapName = self.props._colormap;
        if (cmapName && cmapName !== "none" && !tileData._colormapApplied) {
          if (cmapName !== cachedCmapName) {
            const stops = getColormap(cmapName);
            const imageData = colormapToImageData(stops);
            cachedCmapTexture = self.context.device.createTexture({
              data: imageData.data,
              format: "rgba8unorm",
              width: imageData.width,
              height: imageData.height,
              sampler: {
                minFilter: "linear",
                magFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
              },
            });
            cachedCmapName = cmapName;
          }
          pipeline.push({
            module: Colormap,
            props: { colormapTexture: cachedCmapTexture },
          });
        }

        return pipeline;
      };

      self.setState({
        metadata,
        forwardReproject,
        inverseReproject,
        images,
        defaultGetTileData,
        defaultRenderTile,
      });
    };
  }

  /**
   * Register common projections that may not be included by default.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _registerCommonProjections(proj4Fn: any): Promise<void> {
    // Canadian projections
    proj4Fn.defs(
      "EPSG:3978",
      "+proj=lcc +lat_0=49 +lon_0=-95 +lat_1=49 +lat_2=77 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs +type=crs",
    );
    proj4Fn.defs(
      "EPSG:3979",
      "+proj=lcc +lat_0=49 +lon_0=-95 +lat_1=49 +lat_2=77 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=-0.991,1.9072,0.5129,-1.25033e-07,-4.6785e-08,-5.6529e-08,0 +units=m +no_defs +type=crs",
    );
  }

  /**
   * Build a geoKeysParser function using geotiff-geokeys-to-proj4.
   * This avoids CORS issues when looking up EPSG codes from epsg.io.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _buildGeoKeysParser(): Promise<any> {
    try {
      const geokeysModule = await import("geotiff-geokeys-to-proj4");
      const geoKeysToProj4 = geokeysModule.default || geokeysModule;

      if (!geoKeysToProj4 || typeof geoKeysToProj4.toProj4 !== "function") {
        console.warn("geotiff-geokeys-to-proj4 not available or invalid");
        return null;
      }

      // Pre-load proj4 and register common projections
      const proj4Module = await import("proj4");
      const proj4Fn = proj4Module.default || proj4Module;
      if (typeof proj4Fn === "function") {
        await this._registerCommonProjections(proj4Fn);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return async (geoKeys: any) => {
        try {
          const result = geoKeysToProj4.toProj4(geoKeys);

          if (result && result.proj4) {
            // Remove axis parameter which can cause issues with some projections
            // The axis=ne parameter indicates northing-easting order which can
            // confuse coordinate transformations
            let proj4Str = result.proj4 as string;
            proj4Str = proj4Str.replace(/\+axis=\w+\s*/g, "");

            let parsed: Record<string, unknown> = {};
            if (typeof proj4Fn === "function") {
              try {
                proj4Fn.defs("custom", proj4Str);
                parsed =
                  (proj4Fn.defs("custom") as unknown as Record<
                    string,
                    unknown
                  >) || {};
              } catch (e) {
                console.error("STAC proj4 parsing error:", e);
              }
            }
            return {
              def: proj4Str,
              parsed,
              coordinatesUnits: (result.coordinatesUnits as string) || "metre",
            };
          }
        } catch (e) {
          console.error("STAC geoKeysParser error:", e);
        }
        return null;
      };
    } catch (e) {
      console.error("STAC _buildGeoKeysParser error:", e);
      return null;
    }
  }
}
