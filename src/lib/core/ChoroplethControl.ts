import "../styles/common.css";
import "../styles/choropleth-control.css";
import maplibregl, {
  type IControl,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type {
  ChoroplethControlOptions,
  ChoroplethControlState,
  ChoroplethEvent,
  ChoroplethEventHandler,
  ChoroplethLayerInfo,
  ChoroplethClassificationScheme,
  ColormapName,
  RemoteVectorFormat,
} from "./types";
import { generateId } from "../utils/helpers";
import { getColormap, isValidColormap, getColormapNames } from "../colormaps";
import { getColorAtPosition } from "../utils/color";
import { Legend } from "./Legend";

/**
 * Choropleth map icon for the control button.
 */
const CHOROPLETH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 3h7v7H3z" fill="#4292c6" fill-opacity="0.7" stroke="#2171b5"/>
  <path d="M10 3h7v7h-7z" fill="#9ecae1" fill-opacity="0.7" stroke="#6baed6"/>
  <path d="M17 3h4v7h-4z" fill="#08519c" fill-opacity="0.7" stroke="#08306b"/>
  <path d="M3 10h7v7H3z" fill="#c6dbef" fill-opacity="0.7" stroke="#9ecae1"/>
  <path d="M10 10h7v7h-7z" fill="#6baed6" fill-opacity="0.7" stroke="#4292c6"/>
  <path d="M17 10h4v7h-4z" fill="#deebf7" fill-opacity="0.7" stroke="#c6dbef"/>
  <path d="M3 17h7v4H3z" fill="#2171b5" fill-opacity="0.7" stroke="#08519c"/>
  <path d="M10 17h7v4h-7z" fill="#08306b" fill-opacity="0.7" stroke="#08306b"/>
  <path d="M17 17h4v4h-4z" fill="#4292c6" fill-opacity="0.7" stroke="#2171b5"/>
</svg>`;

/**
 * Classification schemes available for choropleth maps.
 */
const CLASSIFICATION_SCHEMES: {
  value: ChoroplethClassificationScheme;
  label: string;
}[] = [
  { value: "quantile", label: "Quantile" },
  { value: "equal_interval", label: "Equal Interval" },
  { value: "natural_breaks", label: "Natural Breaks (Jenks)" },
  { value: "std_mean", label: "Standard Deviation" },
  { value: "head_tail", label: "Head/Tail Breaks" },
];

/**
 * Default options for the ChoroplethControl.
 */
const DEFAULT_OPTIONS: Required<ChoroplethControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  beforeId: "",
  defaultUrl: "",
  defaultLayerName: "",
  loadDefaultUrl: false,
  defaultFormat: "auto",
  defaultColumn: "",
  defaultColormap: "viridis",
  defaultScheme: "quantile",
  defaultK: 5,
  defaultOpacity: 0.8,
  defaultOutlineColor: "#ffffff",
  defaultExtrude: false,
  defaultScaleFactor: 1.0,
  defaultPickable: true,
  fitBounds: true,
  fitBoundsPadding: 50,
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
 * Detect format from URL.
 */
function detectFormatFromUrl(url: string): RemoteVectorFormat {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".geojson") || lowerUrl.endsWith(".json")) {
    return "geojson";
  }
  if (lowerUrl.endsWith(".parquet") || lowerUrl.endsWith(".geoparquet")) {
    return "geoparquet";
  }
  if (lowerUrl.endsWith(".fgb")) {
    return "flatgeobuf";
  }
  return "geojson";
}

/**
 * Classify numeric values into k bins using the given scheme.
 * Returns an array of break values (length k+1) and the bin index for each value.
 */
function classify(
  values: number[],
  scheme: ChoroplethClassificationScheme,
  k: number,
): { breaks: number[]; bins: number[] } {
  const sorted = [...values].filter((v) => !isNaN(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { breaks: [0, 1], bins: values.map(() => 0) };

  const min = sorted[0];
  const max = sorted[n - 1];

  let breaks: number[];

  switch (scheme) {
    case "equal_interval": {
      breaks = [min];
      const step = (max - min) / k;
      for (let i = 1; i < k; i++) {
        breaks.push(min + step * i);
      }
      breaks.push(max);
      break;
    }
    case "quantile": {
      breaks = [min];
      for (let i = 1; i < k; i++) {
        const idx = Math.floor((i * n) / k);
        breaks.push(sorted[Math.min(idx, n - 1)]);
      }
      breaks.push(max);
      // Deduplicate breaks
      breaks = [...new Set(breaks)].sort((a, b) => a - b);
      break;
    }
    case "natural_breaks": {
      breaks = jenksBreaks(sorted, k);
      break;
    }
    case "std_mean": {
      const mean = sorted.reduce((s, v) => s + v, 0) / n;
      const variance =
        sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      breaks = [min];
      // Create breaks at mean - 2*std, mean - std, mean, mean + std, mean + 2*std
      const stdBreaks = [-2, -1, 0, 1, 2].map((m) => mean + m * std);
      for (const b of stdBreaks) {
        if (b > min && b < max) breaks.push(b);
      }
      breaks.push(max);
      breaks = [...new Set(breaks)].sort((a, b) => a - b);
      break;
    }
    case "head_tail": {
      breaks = [min];
      let remaining = sorted;
      while (breaks.length < k && remaining.length > 1) {
        const mean =
          remaining.reduce((s, v) => s + v, 0) / remaining.length;
        if (mean <= breaks[breaks.length - 1]) break;
        breaks.push(mean);
        remaining = remaining.filter((v) => v > mean);
      }
      breaks.push(max);
      breaks = [...new Set(breaks)].sort((a, b) => a - b);
      break;
    }
    default: {
      // Fall back to equal interval
      breaks = [min];
      const step = (max - min) / k;
      for (let i = 1; i < k; i++) {
        breaks.push(min + step * i);
      }
      breaks.push(max);
    }
  }

  // Assign bin indices to original values
  const bins = values.map((v) => {
    if (isNaN(v)) return 0;
    for (let i = 0; i < breaks.length - 1; i++) {
      if (v <= breaks[i + 1]) return Math.min(i, breaks.length - 2);
    }
    return breaks.length - 2;
  });

  return { breaks, bins };
}

/**
 * Simple Jenks Natural Breaks implementation.
 */
function jenksBreaks(sorted: number[], k: number): number[] {
  const n = sorted.length;
  if (n <= k) {
    return [...new Set(sorted)].sort((a, b) => a - b);
  }

  // Use a simplified Fisher-Jenks algorithm
  const mat1: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(k + 1).fill(Infinity),
  );
  const mat2: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(k + 1).fill(0),
  );

  for (let i = 1; i <= k; i++) {
    mat1[1][i] = 0;
    mat2[1][i] = 1;
  }

  for (let l = 2; l <= n; l++) {
    let ssm = 0;
    let sum = 0;
    for (let m = 1; m <= l; m++) {
      const val = sorted[l - 1];
      sum += val;
      ssm += val * val;
      const variance = ssm - (sum * sum) / m;
      const i4 = l - m + 1;
      if (i4 !== 1) {
        for (let j = 2; j <= k; j++) {
          if (mat1[l][j] >= variance + mat1[i4 - 1][j - 1]) {
            mat2[l][j] = i4;
            mat1[l][j] = variance + mat1[i4 - 1][j - 1];
          }
        }
      }
    }
    mat1[l][1] = ssm - (sum * sum) / l;
    mat2[l][1] = 1;
  }

  const kclass = new Array(k + 1);
  kclass[k] = n;
  let kk = k;
  while (kk >= 2) {
    kclass[kk - 1] = mat2[kclass[kk]][kk] - 1;
    kk--;
  }
  kclass[0] = 0;

  const breaks: number[] = [sorted[0]];
  for (let i = 1; i < k; i++) {
    if (kclass[i] < n) {
      breaks.push(sorted[kclass[i]]);
    }
  }
  breaks.push(sorted[n - 1]);

  return [...new Set(breaks)].sort((a, b) => a - b);
}

/**
 * Generate colors from a colormap for a given number of classes.
 */
function generateColors(colormap: ColormapName, numColors: number): string[] {
  const stops = getColormap(colormap);
  const colors: string[] = [];
  for (let i = 0; i < numColors; i++) {
    const position = numColors === 1 ? 0.5 : i / (numColors - 1);
    colors.push(getColorAtPosition(stops, position));
  }
  return colors;
}

/**
 * A control for adding choropleth (thematic) maps from vector data URLs.
 * Supports classification schemes, colormaps, fill and extrusion modes.
 *
 * @example
 * ```typescript
 * const choropleth = new ChoroplethControl({
 *   defaultUrl: 'https://data.source.coop/giswqs/opengeos/h3_res4_geo.parquet',
 *   defaultColumn: 'value',
 *   defaultColormap: 'viridis',
 *   defaultScheme: 'quantile',
 *   defaultK: 5,
 * });
 * map.addControl(choropleth, 'top-right');
 * ```
 */
export class ChoroplethControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<ChoroplethControlOptions>;
  private _state: ChoroplethControlState;
  private _eventHandlers: Map<ChoroplethEvent, Set<ChoroplethEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _choroplethLayers: Map<string, ChoroplethLayerInfo> = new Map();
  private _legendControls: Map<string, Legend> = new Map();
  private _activePopup?: maplibregl.Popup;
  // Cache of loaded GeoJSON data and their numeric columns
  private _cachedGeojson?: GeoJSON.FeatureCollection;
  private _cachedColumns: string[] = [];

  constructor(options?: ChoroplethControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      layerName: this._options.defaultLayerName,
      beforeId: this._options.beforeId,
      format: this._options.defaultFormat,
      column: this._options.defaultColumn,
      colormap: this._options.defaultColormap,
      scheme: this._options.defaultScheme,
      k: this._options.defaultK,
      opacity: this._options.defaultOpacity,
      showOutline: true,
      outlineColor: this._options.defaultOutlineColor,
      extrude: this._options.defaultExtrude,
      scaleFactor: this._options.defaultScaleFactor,
      pickable: this._options.defaultPickable,
      hasLayer: false,
      layerCount: 0,
      layers: [],
      loading: false,
      error: null,
      status: null,
      availableColumns: [],
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._render();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);
    this._checkZoomVisibility();

    // Auto-load default URL if specified
    if (this._options.loadDefaultUrl && this._options.defaultUrl) {
      const load = () => this._loadData();
      if (this._map.isStyleLoaded()) {
        setTimeout(load, 100);
      } else {
        this._map.once("idle", load);
      }
    }

    return this._container;
  }

  onRemove(): void {
    this._removeAllLayers();
    this._removeAllLegendControls();

    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._eventHandlers.clear();
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

  getState(): ChoroplethControlState {
    return { ...this._state };
  }

  update(options: Partial<ChoroplethControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  on(event: ChoroplethEvent, handler: ChoroplethEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: ChoroplethEvent, handler: ChoroplethEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Programmatically add a choropleth layer.
   */
  async addLayer(
    url?: string,
    column?: string,
    options?: {
      colormap?: ColormapName;
      scheme?: ChoroplethClassificationScheme;
      k?: number;
    },
  ): Promise<void> {
    if (url) this._state.url = url;
    if (column) this._state.column = column;
    if (options?.colormap) this._state.colormap = options.colormap;
    if (options?.scheme) this._state.scheme = options.scheme;
    if (options?.k) this._state.k = options.k;
    await this._loadData();
    if (this._cachedGeojson && this._state.column) {
      await this._addChoroplethLayer();
    }
  }

  /**
   * Remove a choropleth layer by ID.
   */
  removeLayer(id?: string): void {
    this._removeLayer(id);
    this._render();
  }

  /**
   * Get all choropleth layer IDs.
   */
  getLayerIds(): string[] {
    const ids: string[] = [];
    for (const info of this._choroplethLayers.values()) {
      ids.push(...info.layerIds);
    }
    return ids;
  }

  private _emit(
    event: ChoroplethEvent,
    extra?: { url?: string; error?: string; layerId?: string },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), ...extra };
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
    container.className = `maplibregl-ctrl maplibre-gl-choropleth${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) container.style.display = "none";

    Object.assign(container.style, {
      backgroundColor: this._options.backgroundColor,
      borderRadius: `${this._options.borderRadius}px`,
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
    });
    if (this._options.opacity !== 1) {
      container.style.opacity = String(this._options.opacity);
    }

    return container;
  }

  private _render(): void {
    if (!this._container) return;

    const panelEl = this._container.querySelector(
      ".maplibre-gl-choropleth-panel",
    );
    const scrollTop = panelEl ? panelEl.scrollTop : 0;

    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }

    this._updateDisplayState();

    if (scrollTop > 0) {
      const newPanelEl = this._container.querySelector(
        ".maplibre-gl-choropleth-panel",
      );
      if (newPanelEl) {
        newPanelEl.scrollTop = scrollTop;
      }
    }
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = `maplibre-gl-choropleth-button${this._state.hasLayer ? " maplibre-gl-choropleth-button--active" : ""}`;
    this._button.title = "Choropleth Map";
    this._button.setAttribute("aria-label", "Choropleth Map");
    this._button.innerHTML = CHOROPLETH_ICON;
    this._button.addEventListener("click", () => this.expand());

    this._container.appendChild(this._button);
    this._panel = undefined;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-choropleth-panel";
    panel.style.width = `${this._options.panelWidth}px`;
    if (this._options.maxHeight && this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }
    this._panel = panel;

    // Header
    const header = document.createElement("div");
    header.className = "maplibre-gl-choropleth-header";
    const title = document.createElement("span");
    title.className = "maplibre-gl-choropleth-title";
    title.textContent = "Choropleth Map";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-choropleth-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // === DATA SOURCE SECTION ===
    const sectionTitle1 = document.createElement("div");
    sectionTitle1.className = "maplibre-gl-choropleth-section-title";
    sectionTitle1.textContent = "Data Source";
    sectionTitle1.style.marginTop = "0";
    sectionTitle1.style.borderTop = "none";
    sectionTitle1.style.paddingTop = "0";
    panel.appendChild(sectionTitle1);

    // URL input
    const urlGroup = this._createFormGroup("Vector URL", "url");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.id = "choropleth-url";
    urlInput.className = "maplibre-gl-choropleth-input";
    urlInput.style.color = "#000";
    urlInput.placeholder =
      "https://data.source.coop/giswqs/opengeos/h3_res4_geo.parquet";
    urlInput.value = this._state.url;
    urlInput.addEventListener("input", () => {
      this._state.url = urlInput.value;
    });
    urlGroup.appendChild(urlInput);

    const formatHint = document.createElement("div");
    formatHint.className = "maplibre-gl-choropleth-format-hint";
    formatHint.textContent = "Supports GeoJSON, GeoParquet, and FlatGeobuf";
    urlGroup.appendChild(formatHint);
    panel.appendChild(urlGroup);

    // Format selector
    const formatGroup = this._createFormGroup("Format", "format");
    const formatSelect = document.createElement("select");
    formatSelect.id = "choropleth-format";
    formatSelect.className = "maplibre-gl-choropleth-select";
    formatSelect.style.color = "#000";
    const formats: { value: RemoteVectorFormat; label: string }[] = [
      { value: "auto", label: "Auto-detect" },
      { value: "geojson", label: "GeoJSON" },
      { value: "geoparquet", label: "GeoParquet" },
      { value: "flatgeobuf", label: "FlatGeobuf" },
    ];
    for (const fmt of formats) {
      const option = document.createElement("option");
      option.value = fmt.value;
      option.textContent = fmt.label;
      option.selected = fmt.value === this._state.format;
      formatSelect.appendChild(option);
    }
    formatSelect.addEventListener("change", () => {
      this._state.format = formatSelect.value as RemoteVectorFormat;
    });
    formatGroup.appendChild(formatSelect);
    panel.appendChild(formatGroup);

    // Load Data button
    const loadBtnContainer = document.createElement("div");
    loadBtnContainer.className = "maplibre-gl-choropleth-buttons";
    const loadBtn = document.createElement("button");
    loadBtn.className =
      "maplibre-gl-choropleth-btn maplibre-gl-choropleth-btn--primary";
    loadBtn.textContent = this._cachedGeojson ? "Reload Data" : "Load Data";
    loadBtn.disabled = this._state.loading;
    loadBtn.addEventListener("click", () => this._loadData());
    loadBtnContainer.appendChild(loadBtn);
    panel.appendChild(loadBtnContainer);

    // === CLASSIFICATION SECTION (shown only after data is loaded) ===
    if (this._cachedColumns.length > 0) {
      const sectionTitle2 = document.createElement("div");
      sectionTitle2.className = "maplibre-gl-choropleth-section-title";
      sectionTitle2.textContent = "Classification";
      panel.appendChild(sectionTitle2);

      // Column selector
      const columnGroup = this._createFormGroup("Column", "column");
      const columnSelect = document.createElement("select");
      columnSelect.id = "choropleth-column";
      columnSelect.className = "maplibre-gl-choropleth-select";
      columnSelect.style.color = "#000";
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "-- Select column --";
      defaultOpt.disabled = true;
      defaultOpt.selected = !this._state.column;
      columnSelect.appendChild(defaultOpt);
      for (const col of this._cachedColumns) {
        const option = document.createElement("option");
        option.value = col;
        option.textContent = col;
        option.selected = col === this._state.column;
        columnSelect.appendChild(option);
      }
      columnSelect.addEventListener("change", () => {
        this._state.column = columnSelect.value;
      });
      columnGroup.appendChild(columnSelect);
      panel.appendChild(columnGroup);

      // Classification scheme and k (row)
      const classRow = document.createElement("div");
      classRow.className = "maplibre-gl-choropleth-row";

      const schemeGroup = this._createFormGroup("Scheme", "scheme");
      const schemeSelect = document.createElement("select");
      schemeSelect.id = "choropleth-scheme";
      schemeSelect.className = "maplibre-gl-choropleth-select";
      schemeSelect.style.color = "#000";
      for (const s of CLASSIFICATION_SCHEMES) {
        const option = document.createElement("option");
        option.value = s.value;
        option.textContent = s.label;
        option.selected = s.value === this._state.scheme;
        schemeSelect.appendChild(option);
      }
      schemeSelect.addEventListener("change", () => {
        this._state.scheme =
          schemeSelect.value as ChoroplethClassificationScheme;
      });
      schemeGroup.appendChild(schemeSelect);
      classRow.appendChild(schemeGroup);

      const kGroup = this._createFormGroup("Classes", "k");
      const kInput = document.createElement("input");
      kInput.type = "number";
      kInput.id = "choropleth-k";
      kInput.className = "maplibre-gl-choropleth-input";
      kInput.style.color = "#000";
      kInput.min = "2";
      kInput.max = "20";
      kInput.value = String(this._state.k);
      kInput.addEventListener("change", () => {
        this._state.k = Math.max(2, Math.min(20, Number(kInput.value) || 5));
        kInput.value = String(this._state.k);
      });
      kGroup.appendChild(kInput);
      classRow.appendChild(kGroup);

      panel.appendChild(classRow);

      // === STYLING SECTION ===
      const sectionTitle3 = document.createElement("div");
      sectionTitle3.className = "maplibre-gl-choropleth-section-title";
      sectionTitle3.textContent = "Styling";
      panel.appendChild(sectionTitle3);

      // Colormap selector
      const colormapGroup = this._createFormGroup("Colormap", "colormap");
      const colormapSelect = document.createElement("select");
      colormapSelect.id = "choropleth-colormap";
      colormapSelect.className = "maplibre-gl-choropleth-select";
      colormapSelect.style.color = "#000";
      for (const cmapName of getColormapNames()) {
        const option = document.createElement("option");
        option.value = cmapName;
        option.textContent = cmapName;
        option.selected = cmapName === this._state.colormap;
        colormapSelect.appendChild(option);
      }
      colormapSelect.addEventListener("change", () => {
        this._state.colormap = colormapSelect.value as ColormapName;
        this._updateColormapPreview(colormapPreview, this._state.colormap);
      });
      colormapGroup.appendChild(colormapSelect);

      // Colormap preview
      const colormapPreview = document.createElement("div");
      colormapPreview.className = "maplibre-gl-choropleth-colormap-preview";
      this._updateColormapPreview(colormapPreview, this._state.colormap);
      colormapGroup.appendChild(colormapPreview);
      panel.appendChild(colormapGroup);

      // Opacity slider
      const opacityGroup = this._createFormGroup("Opacity", "opacity");
      const sliderRow = document.createElement("div");
      sliderRow.className = "maplibre-gl-choropleth-slider-row";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = "choropleth-opacity";
      slider.className = "maplibre-gl-choropleth-slider";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(Math.round(this._state.opacity * 100));
      const sliderValue = document.createElement("span");
      sliderValue.className = "maplibre-gl-choropleth-slider-value";
      sliderValue.textContent = `${Math.round(this._state.opacity * 100)}%`;
      slider.addEventListener("input", () => {
        const pct = Number(slider.value);
        this._state.opacity = pct / 100;
        sliderValue.textContent = `${pct}%`;
      });
      sliderRow.appendChild(slider);
      sliderRow.appendChild(sliderValue);
      opacityGroup.appendChild(sliderRow);
      panel.appendChild(opacityGroup);

      // Show Outline checkbox + color picker
      const outlineCheckGroup = document.createElement("div");
      outlineCheckGroup.className =
        "maplibre-gl-choropleth-form-group maplibre-gl-choropleth-checkbox-group";
      const outlineCheckLabel = document.createElement("label");
      outlineCheckLabel.className = "maplibre-gl-choropleth-checkbox-label";
      const outlineCheckbox = document.createElement("input");
      outlineCheckbox.type = "checkbox";
      outlineCheckbox.id = "choropleth-show-outline";
      outlineCheckbox.className = "maplibre-gl-choropleth-checkbox";
      outlineCheckbox.checked = this._state.showOutline;
      outlineCheckbox.addEventListener("change", () => {
        this._state.showOutline = outlineCheckbox.checked;
        outlineColorGroup.style.display = outlineCheckbox.checked
          ? "block"
          : "none";
      });
      outlineCheckLabel.appendChild(outlineCheckbox);
      const outlineCheckText = document.createElement("span");
      outlineCheckText.textContent = "Show Outline";
      outlineCheckLabel.appendChild(outlineCheckText);
      outlineCheckGroup.appendChild(outlineCheckLabel);
      panel.appendChild(outlineCheckGroup);

      // Outline color (hidden when outline is disabled)
      const outlineColorGroup = this._createFormGroup(
        "Outline Color",
        "outline-color",
      );
      outlineColorGroup.style.display = this._state.showOutline
        ? "block"
        : "none";
      const outlineRow = document.createElement("div");
      outlineRow.className = "maplibre-gl-choropleth-color-row";
      const outlineColorInput = document.createElement("input");
      outlineColorInput.type = "color";
      outlineColorInput.id = "choropleth-outline-color";
      outlineColorInput.className = "maplibre-gl-choropleth-color-input";
      outlineColorInput.value = this._state.outlineColor;
      outlineColorInput.addEventListener("input", () => {
        this._state.outlineColor = outlineColorInput.value;
        outlineColorText.value = outlineColorInput.value;
      });
      outlineRow.appendChild(outlineColorInput);
      const outlineColorText = document.createElement("input");
      outlineColorText.type = "text";
      outlineColorText.className = "maplibre-gl-choropleth-input";
      outlineColorText.style.color = "#000";
      outlineColorText.style.flex = "1";
      outlineColorText.value = this._state.outlineColor;
      outlineColorText.addEventListener("input", () => {
        this._state.outlineColor = outlineColorText.value;
        outlineColorInput.value = outlineColorText.value;
      });
      outlineRow.appendChild(outlineColorText);
      outlineColorGroup.appendChild(outlineRow);
      panel.appendChild(outlineColorGroup);

      // Extrude checkbox and scale factor
      const extrudeGroup = document.createElement("div");
      extrudeGroup.className =
        "maplibre-gl-choropleth-form-group maplibre-gl-choropleth-checkbox-group";
      const extrudeLabel = document.createElement("label");
      extrudeLabel.className = "maplibre-gl-choropleth-checkbox-label";
      const extrudeCheckbox = document.createElement("input");
      extrudeCheckbox.type = "checkbox";
      extrudeCheckbox.id = "choropleth-extrude";
      extrudeCheckbox.className = "maplibre-gl-choropleth-checkbox";
      extrudeCheckbox.checked = this._state.extrude;
      extrudeCheckbox.addEventListener("change", () => {
        this._state.extrude = extrudeCheckbox.checked;
        // Toggle scale factor visibility
        scaleGroup.style.display = extrudeCheckbox.checked ? "block" : "none";
      });
      extrudeLabel.appendChild(extrudeCheckbox);
      const extrudeText = document.createElement("span");
      extrudeText.textContent = "3D Extrusion (fill-extrusion)";
      extrudeLabel.appendChild(extrudeText);
      extrudeGroup.appendChild(extrudeLabel);
      panel.appendChild(extrudeGroup);

      // Scale factor (hidden when not extruding)
      const scaleGroup = this._createFormGroup("Scale Factor", "scale-factor");
      scaleGroup.style.display = this._state.extrude ? "block" : "none";
      const scaleInput = document.createElement("input");
      scaleInput.type = "number";
      scaleInput.id = "choropleth-scale-factor";
      scaleInput.className = "maplibre-gl-choropleth-input";
      scaleInput.style.color = "#000";
      scaleInput.step = "0.1";
      scaleInput.min = "0.001";
      scaleInput.value = String(this._state.scaleFactor);
      scaleInput.addEventListener("change", () => {
        this._state.scaleFactor = Math.max(
          0.001,
          Number(scaleInput.value) || 1,
        );
      });
      const scaleHint = document.createElement("div");
      scaleHint.className = "maplibre-gl-choropleth-format-hint";
      scaleHint.textContent =
        "Divide column values by this factor for extrusion height";
      scaleGroup.appendChild(scaleInput);
      scaleGroup.appendChild(scaleHint);
      panel.appendChild(scaleGroup);

      // Pickable checkbox
      const pickableGroup = document.createElement("div");
      pickableGroup.className =
        "maplibre-gl-choropleth-form-group maplibre-gl-choropleth-checkbox-group";
      const pickableLabel = document.createElement("label");
      pickableLabel.className = "maplibre-gl-choropleth-checkbox-label";
      const pickableCheckbox = document.createElement("input");
      pickableCheckbox.type = "checkbox";
      pickableCheckbox.id = "choropleth-pickable";
      pickableCheckbox.className = "maplibre-gl-choropleth-checkbox";
      pickableCheckbox.checked = this._state.pickable;
      pickableCheckbox.addEventListener("change", () => {
        this._state.pickable = pickableCheckbox.checked;
      });
      pickableLabel.appendChild(pickableCheckbox);
      const pickableLabelText = document.createElement("span");
      pickableLabelText.textContent = "Pickable (click to show feature info)";
      pickableLabel.appendChild(pickableLabelText);
      pickableGroup.appendChild(pickableLabel);
      panel.appendChild(pickableGroup);

      // Layer name input
      const layerNameGroup = this._createFormGroup("Layer Name", "layer-name");
      const layerNameInput = document.createElement("input");
      layerNameInput.type = "text";
      layerNameInput.id = "choropleth-layer-name";
      layerNameInput.className = "maplibre-gl-choropleth-input";
      layerNameInput.style.color = "#000";
      layerNameInput.placeholder = "Optional custom layer name";
      layerNameInput.value = this._state.layerName;
      layerNameInput.addEventListener("input", () => {
        this._state.layerName = layerNameInput.value;
      });
      layerNameGroup.appendChild(layerNameInput);
      panel.appendChild(layerNameGroup);

      // Before ID input
      const beforeIdGroup = this._createFormGroup(
        "Before Layer ID",
        "before-id",
      );
      const beforeIdInput = document.createElement("input");
      beforeIdInput.type = "text";
      beforeIdInput.id = "choropleth-before-id";
      beforeIdInput.className = "maplibre-gl-choropleth-input";
      beforeIdInput.style.color = "#000";
      beforeIdInput.placeholder = "Optional layer ID to insert before";
      beforeIdInput.value = this._state.beforeId;
      beforeIdInput.addEventListener("input", () => {
        this._state.beforeId = beforeIdInput.value;
      });
      beforeIdGroup.appendChild(beforeIdInput);
      panel.appendChild(beforeIdGroup);

      // Add Choropleth button
      const btns = document.createElement("div");
      btns.className = "maplibre-gl-choropleth-buttons";
      const addBtn = document.createElement("button");
      addBtn.className =
        "maplibre-gl-choropleth-btn maplibre-gl-choropleth-btn--primary";
      addBtn.textContent = "Add Choropleth";
      addBtn.disabled = this._state.loading || !this._state.column;
      addBtn.addEventListener("click", () => this._addChoroplethLayer());
      btns.appendChild(addBtn);
      panel.appendChild(btns);
    }

    // Status/error area
    if (this._state.loading) {
      this._appendStatus("Loading data...", "info");
    } else if (this._state.error) {
      this._appendStatus(this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(this._state.status, "success");
    }

    // Layer list
    if (this._choroplethLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-choropleth-layer-list";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-choropleth-layer-header";
      listHeader.textContent = `Choropleth Layers (${this._choroplethLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [layerId, info] of this._choroplethLayers) {
        const item = document.createElement("div");
        item.className = "maplibre-gl-choropleth-layer-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-choropleth-layer-label";
        label.textContent = `${info.id} (${info.column}, ${info.scheme})`;
        label.title = `${info.url} - ${info.column}`;
        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-choropleth-layer-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "Remove layer";
        removeBtn.addEventListener("click", () => {
          this._removeLayer(layerId);
          this._render();
        });
        item.appendChild(removeBtn);

        listContainer.appendChild(item);

        // Mini legend
        if (info.legendColors && info.legendLabels) {
          const legend = document.createElement("div");
          legend.className = "maplibre-gl-choropleth-legend";

          // Legend header row with title and "Add to Map" button
          const legendHeader = document.createElement("div");
          legendHeader.style.display = "flex";
          legendHeader.style.justifyContent = "space-between";
          legendHeader.style.alignItems = "center";
          legendHeader.style.marginBottom = "4px";
          const legendTitle = document.createElement("div");
          legendTitle.className = "maplibre-gl-choropleth-legend-title";
          legendTitle.style.marginBottom = "0";
          legendTitle.textContent = info.column;
          legendHeader.appendChild(legendTitle);

          const hasMapLegend = this._legendControls.has(layerId);
          const addLegendBtn = document.createElement("button");
          addLegendBtn.className = `maplibre-gl-choropleth-btn${hasMapLegend ? " maplibre-gl-choropleth-btn--danger" : " maplibre-gl-choropleth-btn--primary"}`;
          addLegendBtn.style.flex = "0 0 auto";
          addLegendBtn.style.padding = "3px 8px";
          addLegendBtn.style.fontSize = "10px";
          addLegendBtn.textContent = hasMapLegend
            ? "Remove Legend"
            : "Add to Map";
          addLegendBtn.addEventListener("click", () => {
            if (this._legendControls.has(layerId)) {
              this._removeLegendControl(layerId);
            } else {
              this._addLegendControl(layerId, info);
            }
            this._render();
          });
          legendHeader.appendChild(addLegendBtn);
          legend.appendChild(legendHeader);

          for (let i = 0; i < info.legendColors.length; i++) {
            const legendItem = document.createElement("div");
            legendItem.className = "maplibre-gl-choropleth-legend-item";
            const swatch = document.createElement("div");
            swatch.className = "maplibre-gl-choropleth-legend-swatch";
            swatch.style.backgroundColor = info.legendColors[i];
            legendItem.appendChild(swatch);
            const legendLabel = document.createElement("span");
            legendLabel.textContent = info.legendLabels[i] || "";
            legendItem.appendChild(legendLabel);
            legend.appendChild(legendItem);
          }
          listContainer.appendChild(legend);
        }
      }

      panel.appendChild(listContainer);
    }

    this._container.appendChild(panel);
    this._button = undefined;
  }

  private _createFormGroup(labelText: string, id: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "maplibre-gl-choropleth-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `choropleth-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    message: string,
    type: "info" | "error" | "success",
  ): void {
    if (!this._panel) return;
    const status = document.createElement("div");
    status.className = `maplibre-gl-choropleth-status maplibre-gl-choropleth-status--${type}`;
    status.textContent = message;
    this._panel.appendChild(status);
  }

  private _updateColormapPreview(
    element: HTMLElement,
    colormapName: ColormapName,
  ): void {
    if (!isValidColormap(colormapName)) return;
    const stops = getColormap(colormapName);
    const cssStops = stops
      .map((s) => `${s.color} ${s.position * 100}%`)
      .join(", ");
    element.style.background = `linear-gradient(to right, ${cssStops})`;
  }

  /**
   * Load vector data from URL and detect numeric columns.
   */
  private async _loadData(): Promise<void> {
    if (!this._map || !this._state.url) {
      this._state.error = "Please enter a vector URL.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      let format = this._state.format;
      if (format === "auto") {
        format = detectFormatFromUrl(this._state.url);
      }

      let geojson: GeoJSON.FeatureCollection;

      if (format === "geojson") {
        let response: Response;
        try {
          response = await fetch(this._state.url);
        } catch {
          throw new Error(
            "CORS error: The server doesn't allow cross-origin requests.",
          );
        }
        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        geojson = this._normalizeGeoJSON(data);
      } else if (format === "geoparquet") {
        geojson = await this._loadGeoParquet(this._state.url);
      } else if (format === "flatgeobuf") {
        geojson = await this._loadFlatGeobuf(this._state.url);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      this._cachedGeojson = geojson;

      // Detect numeric columns
      const numericCols = this._detectNumericColumns(geojson);
      this._cachedColumns = numericCols;
      this._state.availableColumns = numericCols;

      // Auto-select first column if none specified
      if (
        !this._state.column &&
        numericCols.length > 0
      ) {
        this._state.column = numericCols[0];
      }

      this._state.loading = false;
      this._state.status = `Loaded ${geojson.features.length} features, ${numericCols.length} numeric columns.`;
      this._render();
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
  }

  /**
   * Detect numeric columns from GeoJSON features.
   */
  private _detectNumericColumns(
    geojson: GeoJSON.FeatureCollection,
  ): string[] {
    const columnStats = new Map<
      string,
      { numericCount: number; totalCount: number }
    >();

    // Sample up to 100 features for performance
    const sampleSize = Math.min(geojson.features.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      const props = geojson.features[i]?.properties;
      if (!props) continue;
      for (const [key, value] of Object.entries(props)) {
        if (!columnStats.has(key)) {
          columnStats.set(key, { numericCount: 0, totalCount: 0 });
        }
        const stats = columnStats.get(key)!;
        stats.totalCount++;
        if (typeof value === "number" && !isNaN(value)) {
          stats.numericCount++;
        }
      }
    }

    // A column is numeric if >80% of sampled values are numbers
    const numericCols: string[] = [];
    for (const [key, stats] of columnStats) {
      if (
        stats.totalCount > 0 &&
        stats.numericCount / stats.totalCount > 0.8
      ) {
        numericCols.push(key);
      }
    }

    return numericCols.sort();
  }

  /**
   * Create and add the choropleth layer to the map.
   */
  private async _addChoroplethLayer(): Promise<void> {
    if (!this._map || !this._cachedGeojson || !this._state.column) {
      this._state.error = "Load data and select a column first.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      const geojson = this._cachedGeojson;
      const column = this._state.column;
      const k = this._state.k;
      const scheme = this._state.scheme;
      const colormapName = this._state.colormap;
      const opacity = this._state.opacity;
      const showOutline = this._state.showOutline;
      const outlineColor = showOutline ? this._state.outlineColor : "transparent";
      const extrude = this._state.extrude;
      const scaleFactor = this._state.scaleFactor;

      // Extract values for the selected column
      const values = geojson.features.map((f) => {
        const v = f.properties?.[column];
        return typeof v === "number" ? v : NaN;
      });

      // Classify
      const { breaks, bins } = classify(values, scheme, k);
      const numClasses = breaks.length - 1;
      const colors = generateColors(colormapName, numClasses);

      // Assign color to each feature
      const coloredGeojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: geojson.features.map((f, i) => ({
          ...f,
          properties: {
            ...f.properties,
            _choropleth_color: colors[bins[i]] || colors[0],
            _choropleth_bin: bins[i],
          },
        })),
      };

      // Generate layer ID
      let layerId = this._state.layerName?.trim();
      if (!layerId) {
        try {
          const urlPath = new URL(this._state.url).pathname;
          const filename = urlPath.split("/").pop() || "";
          layerId = filename.replace(/\.[^.]+$/, "");
        } catch {
          // ignore
        }
      }
      if (!layerId) {
        layerId = generateId("choropleth");
      }
      // Append column to make unique
      layerId = `${layerId}-${column}`;
      const sourceId = `${layerId}-source`;

      // Detect geometry type
      const geometryTypes = new Set<string>();
      for (const feature of coloredGeojson.features) {
        if (feature.geometry) {
          geometryTypes.add(feature.geometry.type);
        }
      }

      // Add source
      this._map.addSource(sourceId, {
        type: "geojson",
        data: coloredGeojson,
        generateId: true,
      });

      const layerIds: string[] = [];
      const stateBeforeId = this._state.beforeId?.trim();
      const optionsBeforeId = this._options.beforeId;
      const beforeIdToUse = stateBeforeId || optionsBeforeId;
      const beforeId =
        beforeIdToUse && this._map.getLayer(beforeIdToUse)
          ? beforeIdToUse
          : undefined;

      const hasPolygons =
        geometryTypes.has("Polygon") || geometryTypes.has("MultiPolygon");
      const hasLines =
        geometryTypes.has("LineString") ||
        geometryTypes.has("MultiLineString");
      const hasPoints =
        geometryTypes.has("Point") || geometryTypes.has("MultiPoint");

      if (hasPolygons) {
        if (extrude) {
          // Fill-extrusion layer with interpolate expressions
          const fillExtrusionColorExpr: unknown[] = [
            "interpolate",
            ["linear"],
            ["get", column],
          ];
          const fillExtrusionHeightExpr: unknown[] = [
            "interpolate",
            ["linear"],
            ["get", column],
          ];

          for (let i = 0; i < breaks.length; i++) {
            const colorIdx = Math.min(i, colors.length - 1);
            fillExtrusionColorExpr.push(breaks[i], colors[colorIdx]);
            fillExtrusionHeightExpr.push(
              breaks[i],
              breaks[i] / scaleFactor,
            );
          }

          const extrusionLayerId = `${layerId}-extrusion`;
          this._map.addLayer(
            {
              id: extrusionLayerId,
              type: "fill-extrusion",
              source: sourceId,
              filter: [
                "any",
                ["==", ["geometry-type"], "Polygon"],
                ["==", ["geometry-type"], "MultiPolygon"],
              ],
              paint: {
                "fill-extrusion-color":
                  fillExtrusionColorExpr as maplibregl.ExpressionSpecification,
                "fill-extrusion-height":
                  fillExtrusionHeightExpr as maplibregl.ExpressionSpecification,
                "fill-extrusion-base": 10, // Small offset to avoid z-fighting on globe projection
                "fill-extrusion-opacity": opacity,
              },
            },
            beforeId,
          );
          layerIds.push(extrusionLayerId);
        } else {
          // Regular fill layer using pre-assigned colors
          const fillLayerId = `${layerId}-fill`;
          this._map.addLayer(
            {
              id: fillLayerId,
              type: "fill",
              source: sourceId,
              filter: [
                "any",
                ["==", ["geometry-type"], "Polygon"],
                ["==", ["geometry-type"], "MultiPolygon"],
              ],
              paint: {
                "fill-color": [
                  "get",
                  "_choropleth_color",
                ] as unknown as maplibregl.ExpressionSpecification,
                "fill-opacity": opacity,
                "fill-outline-color": outlineColor,
              },
            },
            beforeId,
          );
          layerIds.push(fillLayerId);

          // Outline layer (only when outline is enabled)
          if (showOutline) {
            const outlineLayerId = `${layerId}-outline`;
            this._map.addLayer(
              {
                id: outlineLayerId,
                type: "line",
                source: sourceId,
                filter: [
                  "any",
                  ["==", ["geometry-type"], "Polygon"],
                  ["==", ["geometry-type"], "MultiPolygon"],
                ],
                paint: {
                  "line-color": outlineColor,
                  "line-width": 0.5,
                  "line-opacity": opacity,
                },
              },
              beforeId,
            );
            layerIds.push(outlineLayerId);
          }
        }
      }

      if (hasLines) {
        const lineLayerId = `${layerId}-line`;
        this._map.addLayer(
          {
            id: lineLayerId,
            type: "line",
            source: sourceId,
            filter: [
              "any",
              ["==", ["geometry-type"], "LineString"],
              ["==", ["geometry-type"], "MultiLineString"],
            ],
            paint: {
              "line-color": [
                "get",
                "_choropleth_color",
              ] as unknown as maplibregl.ExpressionSpecification,
              "line-width": 2,
              "line-opacity": opacity,
            },
          },
          beforeId,
        );
        layerIds.push(lineLayerId);
      }

      if (hasPoints) {
        const pointLayerId = `${layerId}-point`;
        this._map.addLayer(
          {
            id: pointLayerId,
            type: "circle",
            source: sourceId,
            filter: [
              "any",
              ["==", ["geometry-type"], "Point"],
              ["==", ["geometry-type"], "MultiPoint"],
            ],
            paint: {
              "circle-color": [
                "get",
                "_choropleth_color",
              ] as unknown as maplibregl.ExpressionSpecification,
              "circle-radius": 6,
              "circle-stroke-color": outlineColor,
              "circle-stroke-width": showOutline ? 1 : 0,
              "circle-opacity": opacity,
            },
          },
          beforeId,
        );
        layerIds.push(pointLayerId);
      }

      // Set up pickable interactions
      if (this._state.pickable && this._map) {
        const map = this._map;
        for (const lid of layerIds) {
          map.on("mouseenter", lid, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", lid, () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", lid, (e) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties || {};
            const entries = Object.entries(props).filter(
              ([key]) =>
                !key.startsWith("_choropleth_"),
            );
            if (entries.length === 0) return;

            let html = '<div class="maplibre-gl-choropleth-popup">';
            html +=
              '<table class="maplibre-gl-choropleth-popup-table">';
            for (const [key, value] of entries) {
              const displayValue =
                typeof value === "number"
                  ? Number.isInteger(value)
                    ? value.toString()
                    : value.toFixed(4)
                  : String(value);
              html += `<tr><td><strong>${key}</strong></td><td>${displayValue}</td></tr>`;
            }
            html += "</table></div>";

            if (this._activePopup) {
              this._activePopup.remove();
            }

            this._activePopup = new maplibregl.Popup({
              closeButton: true,
              maxWidth: "300px",
            })
              .setLngLat(e.lngLat)
              .setHTML(html)
              .addTo(map);
          });
        }
      }

      // Build legend
      const legendColors = colors;
      const legendLabels: string[] = [];
      for (let i = 0; i < breaks.length - 1; i++) {
        const lo = this._formatBreak(breaks[i]);
        const hi = this._formatBreak(breaks[i + 1]);
        legendLabels.push(`${lo} – ${hi}`);
      }

      // Store layer info
      const layerInfo: ChoroplethLayerInfo = {
        id: layerId,
        url: this._state.url,
        sourceId,
        layerIds,
        featureCount: coloredGeojson.features.length,
        geometryTypes: Array.from(geometryTypes),
        column,
        scheme,
        k: numClasses,
        colormap: colormapName,
        breaks,
        legendColors,
        legendLabels,
        opacity,
        extrude,
        scaleFactor,
      };
      this._choroplethLayers.set(layerId, layerInfo);

      this._state.hasLayer = this._choroplethLayers.size > 0;
      this._state.layerCount = this._choroplethLayers.size;
      this._state.layers = Array.from(this._choroplethLayers.values());
      this._state.loading = false;
      this._state.status = `Added choropleth: ${column} (${numClasses} classes, ${scheme}).`;

      // Fit bounds
      if (this._options.fitBounds && coloredGeojson.features.length > 0) {
        this._fitToData(coloredGeojson);
      }

      this._render();
      this._emit("layeradd", { url: this._state.url, layerId });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
  }

  private _formatBreak(value: number): string {
    if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
    if (Math.abs(value) >= 1) return value.toFixed(2);
    if (Math.abs(value) >= 0.01) return value.toFixed(4);
    return value.toExponential(2);
  }

  private _normalizeGeoJSON(data: GeoJSON.GeoJSON): GeoJSON.FeatureCollection {
    if (data.type === "FeatureCollection") {
      return data as GeoJSON.FeatureCollection;
    } else if (data.type === "Feature") {
      return {
        type: "FeatureCollection",
        features: [data as GeoJSON.Feature],
      };
    } else {
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: data as GeoJSON.Geometry,
          },
        ],
      };
    }
  }

  private async _fetchWithCorsProxy(url: string): Promise<Response> {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) return response;
    } catch {
      // Direct fetch failed
    }

    const publicProxy = "https://corsproxy.io/?";
    try {
      const response = await fetch(publicProxy + encodeURIComponent(url), {
        mode: "cors",
      });
      if (response.ok) return response;
    } catch {
      // All attempts failed
    }

    throw new Error(
      "CORS error: Unable to fetch the file. The server doesn't allow cross-origin requests.",
    );
  }

  private async _loadGeoParquet(
    url: string,
  ): Promise<GeoJSON.FeatureCollection> {
    const { getDuckDBConverter } =
      await import("../converters/DuckDBConverter");
    const converter = getDuckDBConverter();

    const response = await this._fetchWithCorsProxy(url);

    let buffer: ArrayBuffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (bufferError) {
      throw new Error(
        `Failed to read GeoParquet response: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`,
      );
    }

    let result;
    try {
      result = await converter.convert(buffer, "data.parquet");
    } catch (convertError) {
      throw new Error(
        `Failed to convert GeoParquet: ${convertError instanceof Error ? convertError.message : String(convertError)}`,
      );
    }

    if (result.geojson) {
      return result.geojson as GeoJSON.FeatureCollection;
    }
    throw new Error("Failed to convert GeoParquet: No GeoJSON output");
  }

  private async _loadFlatGeobuf(
    url: string,
  ): Promise<GeoJSON.FeatureCollection> {
    const fgb = await import("flatgeobuf/lib/mjs/geojson.js");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch: ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("Response body is null - streaming not supported");
    }

    const features: GeoJSON.Feature[] = [];
    for await (const feature of fgb.deserialize(response.body)) {
      features.push(feature as GeoJSON.Feature);
    }

    return { type: "FeatureCollection", features };
  }

  private _fitToData(geojson: GeoJSON.FeatureCollection): void {
    if (!this._map) return;

    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;

    const processCoords = (coords: number[]) => {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    };

    const processCoordArray = (
      coords: number[][] | number[][][] | number[][][][],
    ) => {
      for (const item of coords) {
        if (typeof item[0] === "number") {
          processCoords(item as number[]);
        } else {
          processCoordArray(item as number[][] | number[][][]);
        }
      }
    };

    for (const feature of geojson.features) {
      if (!feature.geometry) continue;
      const geom = feature.geometry;
      if (geom.type === "Point") {
        processCoords(geom.coordinates);
      } else if (geom.type === "MultiPoint" || geom.type === "LineString") {
        processCoordArray(geom.coordinates);
      } else if (geom.type === "MultiLineString" || geom.type === "Polygon") {
        processCoordArray(geom.coordinates);
      } else if (geom.type === "MultiPolygon") {
        processCoordArray(geom.coordinates);
      }
    }

    if (minLng !== Infinity) {
      this._map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: this._options.fitBoundsPadding },
      );
    }
  }

  private _removeLayer(id?: string): void {
    if (!this._map) return;

    if (id) {
      const info = this._choroplethLayers.get(id);
      if (info) {
        for (const lid of info.layerIds) {
          try {
            if (this._map.getLayer(lid)) {
              this._map.removeLayer(lid);
            }
          } catch {
            // Layer may already be removed
          }
        }
        try {
          if (this._map.getSource(info.sourceId)) {
            this._map.removeSource(info.sourceId);
          }
        } catch {
          // Source may already be removed
        }
      }
      this._choroplethLayers.delete(id);
      this._removeLegendControl(id);
      this._state.hasLayer = this._choroplethLayers.size > 0;
      this._state.layerCount = this._choroplethLayers.size;
      this._state.layers = Array.from(this._choroplethLayers.values());
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove", { layerId: id });
    } else {
      this._removeAllLayers();
    }
  }

  /**
   * Add a Legend control to the map for a given choropleth layer.
   */
  private _addLegendControl(
    layerId: string,
    info: ChoroplethLayerInfo,
  ): void {
    if (!this._map || this._legendControls.has(layerId)) return;

    const items = info.legendColors.map((color, i) => ({
      label: info.legendLabels[i] || "",
      color,
      shape: "square" as const,
    }));

    const legend = new Legend({
      title: info.column,
      items,
      position: "bottom-left",
      collapsible: true,
      collapsed: false,
      visible: true,
    });

    this._map.addControl(legend, "bottom-left");
    this._legendControls.set(layerId, legend);
  }

  /**
   * Remove a Legend control from the map for a given choropleth layer.
   */
  private _removeLegendControl(layerId: string): void {
    if (!this._map) return;
    const legend = this._legendControls.get(layerId);
    if (legend) {
      this._map.removeControl(legend);
      this._legendControls.delete(layerId);
    }
  }

  /**
   * Remove all Legend controls from the map.
   */
  private _removeAllLegendControls(): void {
    if (!this._map) return;
    for (const [, legend] of this._legendControls) {
      try {
        this._map.removeControl(legend);
      } catch {
        // ignore
      }
    }
    this._legendControls.clear();
  }

  private _removeAllLayers(): void {
    if (!this._map) return;

    for (const [, info] of this._choroplethLayers) {
      for (const lid of info.layerIds) {
        try {
          if (this._map.getLayer(lid)) {
            this._map.removeLayer(lid);
          }
        } catch {
          // ignore
        }
      }
      try {
        if (this._map.getSource(info.sourceId)) {
          this._map.removeSource(info.sourceId);
        }
      } catch {
        // ignore
      }
    }
    this._choroplethLayers.clear();
    this._removeAllLegendControls();
    this._state.hasLayer = false;
    this._state.layerCount = 0;
    this._state.layers = [];
    this._state.status = null;
    this._state.error = null;
    this._emit("layerremove");
  }
}
