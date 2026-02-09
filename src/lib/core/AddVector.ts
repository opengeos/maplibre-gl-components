import "../styles/common.css";
import "../styles/add-vector.css";
import maplibregl, {
  type IControl,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type {
  AddVectorControlOptions,
  AddVectorControlState,
  AddVectorEvent,
  AddVectorEventHandler,
  AddVectorLayerInfo,
  RemoteVectorFormat,
} from "./types";
import { generateId } from "../utils/helpers";

/**
 * Vector/polygon icon for the control button.
 */
const VECTOR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="5" cy="5" r="3" fill="currentColor"/>
  <polyline points="12 4 20 4 20 12" stroke-width="2"/>
  <polygon points="4 14 12 11 18 16 14 22 6 22 4 14" fill="currentColor" fill-opacity="0.25"/>
</svg>`;

/**
 * Default options for the AddVectorControl.
 */
const DEFAULT_OPTIONS: Required<AddVectorControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  beforeId: "",
  defaultUrl: "",
  defaultLayerName: "",
  loadDefaultUrl: false,
  defaultFormat: "auto",
  defaultOpacity: 1,
  defaultFillColor: "#3388ff",
  defaultStrokeColor: "#3388ff",
  defaultCircleColor: "#3388ff",
  defaultPickable: true,
  corsProxy: "",
  fitBounds: true,
  fitBoundsPadding: 50,
  panelWidth: 300,
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
  return "geojson"; // Default fallback
}

/**
 * Get badge class for format.
 */
function getFormatBadgeClass(format: RemoteVectorFormat): string {
  switch (format) {
    case "geoparquet":
      return "maplibre-gl-add-vector-badge--parquet";
    case "flatgeobuf":
      return "maplibre-gl-add-vector-badge--fgb";
    default:
      return "";
  }
}

/**
 * A control for adding vector layers from URLs (GeoJSON, GeoParquet, FlatGeobuf).
 *
 * @example
 * ```typescript
 * const addVectorControl = new AddVectorControl({
 *   defaultUrl: 'https://example.com/data.geojson',
 *   loadDefaultUrl: true,
 * });
 * map.addControl(addVectorControl, 'top-right');
 *
 * addVectorControl.on('layeradd', (event) => {
 *   console.log('Vector layer added:', event.url);
 * });
 * ```
 */
export class AddVectorControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<AddVectorControlOptions>;
  private _state: AddVectorControlState;
  private _eventHandlers: Map<AddVectorEvent, Set<AddVectorEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _vectorLayers: Map<string, AddVectorLayerInfo> = new Map();
  private _activePopup?: maplibregl.Popup;

  constructor(options?: AddVectorControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      layerName: this._options.defaultLayerName,
      beforeId: this._options.beforeId,
      format: this._options.defaultFormat,
      layerOpacity: this._options.defaultOpacity,
      fillColor: this._options.defaultFillColor,
      strokeColor: this._options.defaultStrokeColor,
      circleColor: this._options.defaultCircleColor,
      pickable: this._options.defaultPickable,
      hasLayer: false,
      layerCount: 0,
      layers: [],
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

    // Auto-load default URL if specified
    if (this._options.loadDefaultUrl && this._options.defaultUrl) {
      const loadLayer = () => {
        this._addLayer();
      };
      if (this._map.isStyleLoaded()) {
        setTimeout(loadLayer, 100);
      } else {
        this._map.once("idle", loadLayer);
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

  getState(): AddVectorControlState {
    return { ...this._state };
  }

  update(options: Partial<AddVectorControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  on(event: AddVectorEvent, handler: AddVectorEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: AddVectorEvent, handler: AddVectorEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Programmatically add a vector layer from URL.
   */
  async addLayer(url?: string, format?: RemoteVectorFormat): Promise<void> {
    if (url) this._state.url = url;
    if (format) this._state.format = format;
    await this._addLayer();
  }

  /**
   * Programmatically remove a vector layer by ID, or all layers if no ID given.
   */
  removeLayer(id?: string): void {
    this._removeLayer(id);
    this._render();
  }

  /**
   * Get all vector layer IDs.
   */
  getLayerIds(): string[] {
    const ids: string[] = [];
    for (const info of this._vectorLayers.values()) {
      ids.push(...info.layerIds);
    }
    return ids;
  }

  /**
   * Find the source info that contains a specific layer ID.
   */
  private _findSourceByLayerId(
    layerId: string,
  ): AddVectorLayerInfo | undefined {
    for (const info of this._vectorLayers.values()) {
      if (info.layerIds.includes(layerId)) {
        return info;
      }
    }
    return undefined;
  }

  /**
   * Get the opacity of a layer by its layer ID.
   */
  getLayerOpacity(id: string): number | null {
    let info = this._vectorLayers.get(id);
    if (!info) {
      info = this._findSourceByLayerId(id);
    }
    return info?.opacity ?? null;
  }

  /**
   * Set the opacity of a layer by its layer ID.
   */
  setLayerOpacity(id: string, opacity: number): void {
    if (!this._map) return;
    const clampedOpacity = Math.max(0, Math.min(1, opacity));

    const sourceInfo = this._vectorLayers.get(id);
    if (sourceInfo) {
      sourceInfo.opacity = clampedOpacity;
      for (const layerId of sourceInfo.layerIds) {
        this._setLayerOpacityDirect(layerId, clampedOpacity);
      }
      return;
    }

    const info = this._findSourceByLayerId(id);
    if (info) {
      this._setLayerOpacityDirect(id, clampedOpacity);
    }
  }

  /**
   * Set opacity directly on a MapLibre layer.
   */
  private _setLayerOpacityDirect(layerId: string, opacity: number): void {
    if (!this._map) return;
    const layer = this._map.getLayer(layerId);
    if (!layer) return;

    const type = layer.type;
    if (type === "fill") {
      this._map.setPaintProperty(layerId, "fill-opacity", opacity);
    } else if (type === "line") {
      this._map.setPaintProperty(layerId, "line-opacity", opacity);
    } else if (type === "circle") {
      this._map.setPaintProperty(layerId, "circle-opacity", opacity);
    }
  }

  /**
   * Get the visibility of a layer.
   */
  getLayerVisibility(id: string): boolean {
    if (!this._map) return false;

    const sourceInfo = this._vectorLayers.get(id);
    if (sourceInfo && sourceInfo.layerIds.length > 0) {
      const visibility = this._map.getLayoutProperty(
        sourceInfo.layerIds[0],
        "visibility",
      );
      return visibility !== "none";
    }

    const info = this._findSourceByLayerId(id);
    if (info) {
      const visibility = this._map.getLayoutProperty(id, "visibility");
      return visibility !== "none";
    }

    return false;
  }

  /**
   * Set the visibility of a layer.
   */
  setLayerVisibility(id: string, visible: boolean): void {
    if (!this._map) return;

    const sourceInfo = this._vectorLayers.get(id);
    if (sourceInfo) {
      for (const layerId of sourceInfo.layerIds) {
        this._map.setLayoutProperty(
          layerId,
          "visibility",
          visible ? "visible" : "none",
        );
      }
      return;
    }

    const info = this._findSourceByLayerId(id);
    if (info) {
      this._map.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none",
      );
    }
  }

  private _emit(
    event: AddVectorEvent,
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
    container.className = `maplibregl-ctrl maplibre-gl-add-vector${
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
    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }

    this._updateDisplayState();
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = `maplibre-gl-add-vector-button${this._state.hasLayer ? " maplibre-gl-add-vector-button--active" : ""}`;
    this._button.title = "Add Vector Layer";
    this._button.setAttribute("aria-label", "Add Vector Layer");
    this._button.innerHTML = VECTOR_ICON;
    this._button.addEventListener("click", () => this.expand());

    this._container.appendChild(this._button);
    this._panel = undefined;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-add-vector-panel";
    panel.style.width = `${this._options.panelWidth}px`;
    this._panel = panel;

    // Header
    const header = document.createElement("div");
    header.className = "maplibre-gl-add-vector-header";
    const title = document.createElement("span");
    title.className = "maplibre-gl-add-vector-title";
    title.textContent = "Add Vector Layer";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-add-vector-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // URL input
    const urlGroup = this._createFormGroup("Vector URL", "url");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.id = "add-vector-url";
    urlInput.className = "maplibre-gl-add-vector-input";
    urlInput.placeholder = "https://flatgeobuf.org/test/data/UScounties.fgb";
    urlInput.value = this._state.url;
    urlInput.addEventListener("input", () => {
      this._state.url = urlInput.value;
      // Auto-detect format for UI display only (don't mutate state.format)
      if (this._state.format === "auto" && urlInput.value) {
        const detected = detectFormatFromUrl(urlInput.value);
        formatSelect.value = detected;
      }
    });
    urlGroup.appendChild(urlInput);

    const formatHint = document.createElement("div");
    formatHint.className = "maplibre-gl-add-vector-format-hint";
    formatHint.textContent = "Supports GeoJSON, GeoParquet, and FlatGeobuf";
    urlGroup.appendChild(formatHint);
    panel.appendChild(urlGroup);

    // Format selector
    const formatGroup = this._createFormGroup("Format", "format");
    const formatSelect = document.createElement("select");
    formatSelect.id = "add-vector-format";
    formatSelect.className = "maplibre-gl-add-vector-select";
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

    // Fill color
    const fillColorGroup = this._createFormGroup("Fill Color", "fill-color");
    const fillColorRow = document.createElement("div");
    fillColorRow.className = "maplibre-gl-add-vector-color-row";
    const fillColorInput = document.createElement("input");
    fillColorInput.type = "color";
    fillColorInput.id = "add-vector-fill-color";
    fillColorInput.className = "maplibre-gl-add-vector-color-input";
    fillColorInput.value = this._state.fillColor;
    fillColorInput.addEventListener("input", () => {
      this._state.fillColor = fillColorInput.value;
    });
    fillColorRow.appendChild(fillColorInput);
    const fillColorText = document.createElement("input");
    fillColorText.type = "text";
    fillColorText.className = "maplibre-gl-add-vector-input";
    fillColorText.style.flex = "1";
    fillColorText.value = this._state.fillColor;
    fillColorText.addEventListener("input", () => {
      this._state.fillColor = fillColorText.value;
      fillColorInput.value = fillColorText.value;
    });
    fillColorRow.appendChild(fillColorText);
    fillColorGroup.appendChild(fillColorRow);
    panel.appendChild(fillColorGroup);

    // Stroke color
    const strokeColorGroup = this._createFormGroup(
      "Stroke Color",
      "stroke-color",
    );
    const strokeColorRow = document.createElement("div");
    strokeColorRow.className = "maplibre-gl-add-vector-color-row";
    const strokeColorInput = document.createElement("input");
    strokeColorInput.type = "color";
    strokeColorInput.id = "add-vector-stroke-color";
    strokeColorInput.className = "maplibre-gl-add-vector-color-input";
    strokeColorInput.value = this._state.strokeColor;
    strokeColorInput.addEventListener("input", () => {
      this._state.strokeColor = strokeColorInput.value;
    });
    strokeColorRow.appendChild(strokeColorInput);
    const strokeColorText = document.createElement("input");
    strokeColorText.type = "text";
    strokeColorText.className = "maplibre-gl-add-vector-input";
    strokeColorText.style.flex = "1";
    strokeColorText.value = this._state.strokeColor;
    strokeColorText.addEventListener("input", () => {
      this._state.strokeColor = strokeColorText.value;
      strokeColorInput.value = strokeColorText.value;
    });
    strokeColorRow.appendChild(strokeColorText);
    strokeColorGroup.appendChild(strokeColorRow);
    panel.appendChild(strokeColorGroup);

    // Opacity slider
    const opacityGroup = this._createFormGroup("Opacity", "opacity");
    const sliderRow = document.createElement("div");
    sliderRow.className = "maplibre-gl-add-vector-slider-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = "add-vector-opacity";
    slider.className = "maplibre-gl-add-vector-slider";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round(this._state.layerOpacity * 100));
    const sliderValue = document.createElement("span");
    sliderValue.className = "maplibre-gl-add-vector-slider-value";
    sliderValue.textContent = `${Math.round(this._state.layerOpacity * 100)}%`;
    slider.addEventListener("input", () => {
      const pct = Number(slider.value);
      this._state.layerOpacity = pct / 100;
      sliderValue.textContent = `${pct}%`;
      // Update opacity for all existing layers
      for (const [, info] of this._vectorLayers) {
        for (const layerId of info.layerIds) {
          this._setLayerOpacityDirect(layerId, this._state.layerOpacity);
        }
        info.opacity = this._state.layerOpacity;
      }
    });
    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderValue);
    opacityGroup.appendChild(sliderRow);
    panel.appendChild(opacityGroup);

    // Pickable checkbox
    const pickableGroup = document.createElement("div");
    pickableGroup.className =
      "maplibre-gl-add-vector-form-group maplibre-gl-add-vector-checkbox-group";
    const pickableLabel = document.createElement("label");
    pickableLabel.className = "maplibre-gl-add-vector-checkbox-label";
    const pickableCheckbox = document.createElement("input");
    pickableCheckbox.type = "checkbox";
    pickableCheckbox.id = "add-vector-pickable";
    pickableCheckbox.className = "maplibre-gl-add-vector-checkbox";
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
    layerNameInput.id = "add-vector-layer-name";
    layerNameInput.className = "maplibre-gl-add-vector-input";
    layerNameInput.placeholder = "Optional custom layer name";
    layerNameInput.value = this._state.layerName;
    layerNameInput.addEventListener("input", () => {
      this._state.layerName = layerNameInput.value;
    });
    layerNameGroup.appendChild(layerNameInput);
    panel.appendChild(layerNameGroup);

    // Before ID input
    const beforeIdGroup = this._createFormGroup("Before Layer ID", "before-id");
    const beforeIdInput = document.createElement("input");
    beforeIdInput.type = "text";
    beforeIdInput.id = "add-vector-before-id";
    beforeIdInput.className = "maplibre-gl-add-vector-input";
    beforeIdInput.placeholder = "Optional layer ID to insert before";
    beforeIdInput.value = this._state.beforeId;
    beforeIdInput.addEventListener("input", () => {
      this._state.beforeId = beforeIdInput.value;
    });
    beforeIdGroup.appendChild(beforeIdInput);
    panel.appendChild(beforeIdGroup);

    // Buttons
    const btns = document.createElement("div");
    btns.className = "maplibre-gl-add-vector-buttons";

    const addBtn = document.createElement("button");
    addBtn.className =
      "maplibre-gl-add-vector-btn maplibre-gl-add-vector-btn--primary";
    addBtn.textContent = "Add Layer";
    addBtn.disabled = this._state.loading;
    addBtn.addEventListener("click", () => this._addLayer());
    btns.appendChild(addBtn);

    panel.appendChild(btns);

    // Status/error area
    if (this._state.loading) {
      this._appendStatus("Loading vector data...", "info");
    } else if (this._state.error) {
      this._appendStatus(this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(this._state.status, "success");
    }

    // Layer list
    if (this._vectorLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-add-vector-list";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-add-vector-list-header";
      listHeader.textContent = `Layers (${this._vectorLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [sourceId, info] of this._vectorLayers) {
        const item = document.createElement("div");
        item.className = "maplibre-gl-add-vector-list-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-add-vector-list-label";
        let displayName: string;
        try {
          const urlObj = new URL(info.url);
          displayName = urlObj.pathname.split("/").pop() || info.url;
        } catch {
          displayName = info.url;
        }
        label.textContent = displayName;
        label.title = info.url;

        // Add badge for format
        const badge = document.createElement("span");
        badge.className = `maplibre-gl-add-vector-badge ${getFormatBadgeClass(info.format)}`;
        badge.textContent = info.format === "auto" ? "geojson" : info.format;
        label.appendChild(badge);

        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-add-vector-list-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "Remove layer";
        removeBtn.addEventListener("click", () => {
          this._removeLayer(sourceId);
          this._render();
        });
        item.appendChild(removeBtn);

        listContainer.appendChild(item);
      }

      panel.appendChild(listContainer);
    }

    this._container.appendChild(panel);
    this._button = undefined;
  }

  private _createFormGroup(labelText: string, id: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "maplibre-gl-add-vector-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `add-vector-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    message: string,
    type: "info" | "error" | "success",
  ): void {
    if (!this._panel) return;
    const status = document.createElement("div");
    status.className = `maplibre-gl-add-vector-status maplibre-gl-add-vector-status--${type}`;
    status.textContent = message;
    this._panel.appendChild(status);
  }

  private async _addLayer(): Promise<void> {
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
      // Determine format
      let format = this._state.format;
      if (format === "auto") {
        format = detectFormatFromUrl(this._state.url);
      }

      let geojson: GeoJSON.FeatureCollection;

      if (format === "geojson") {
        // Fetch GeoJSON directly
        let response: Response;
        try {
          response = await fetch(this._state.url);
        } catch {
          throw new Error(
            `CORS error: The server doesn't allow cross-origin requests. Try using a CORS-enabled URL.`,
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
        // Use hyparquet or parquet-wasm to read GeoParquet
        geojson = await this._loadGeoParquet(this._state.url);
      } else if (format === "flatgeobuf") {
        // Use flatgeobuf library
        geojson = await this._loadFlatGeobuf(this._state.url);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      // Generate layer ID: custom name > filename from URL > random ID
      let layerId = this._state.layerName?.trim();
      if (!layerId) {
        // Try to extract filename without extension from URL
        try {
          const urlPath = new URL(this._state.url).pathname;
          const filename = urlPath.split("/").pop() || "";
          // Remove extension
          layerId = filename.replace(/\.[^.]+$/, "");
        } catch {
          // URL parsing failed, use random ID
        }
      }
      if (!layerId) {
        layerId = generateId("addvec");
      }
      const sourceId = `${layerId}-source`;

      // Analyze geometry types
      const geometryTypes = new Set<string>();
      for (const feature of geojson.features) {
        if (feature.geometry) {
          geometryTypes.add(feature.geometry.type);
        }
      }

      // Add source
      this._map.addSource(sourceId, {
        type: "geojson",
        data: geojson,
        generateId: true,
      });

      const layerIds: string[] = [];
      // Use beforeId from state (UI input) or fall back to options
      const stateBeforeId = this._state.beforeId?.trim();
      const optionsBeforeId = this._options.beforeId;
      const beforeIdToUse = stateBeforeId || optionsBeforeId;
      const beforeId =
        beforeIdToUse && this._map.getLayer(beforeIdToUse)
          ? beforeIdToUse
          : undefined;

      // Add polygon fill layer
      if (geometryTypes.has("Polygon") || geometryTypes.has("MultiPolygon")) {
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
              "fill-color": this._state.fillColor,
              "fill-opacity": this._state.layerOpacity,
            },
          },
          beforeId,
        );
        layerIds.push(fillLayerId);

        // Add polygon outline
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
              "line-color": this._state.strokeColor,
              "line-width": 2,
              "line-opacity": this._state.layerOpacity,
            },
          },
          beforeId,
        );
        layerIds.push(outlineLayerId);
      }

      // Add line layer
      if (
        geometryTypes.has("LineString") ||
        geometryTypes.has("MultiLineString")
      ) {
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
              "line-color": this._state.strokeColor,
              "line-width": 2,
              "line-opacity": this._state.layerOpacity,
            },
          },
          beforeId,
        );
        layerIds.push(lineLayerId);
      }

      // Add point layer
      if (geometryTypes.has("Point") || geometryTypes.has("MultiPoint")) {
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
              "circle-radius": 6,
              "circle-color": this._state.circleColor,
              "circle-stroke-color": this._state.strokeColor,
              "circle-stroke-width": 2,
              "circle-opacity": this._state.layerOpacity,
            },
          },
          beforeId,
        );
        layerIds.push(pointLayerId);
      }

      // Set up pickable interactions if enabled
      if (this._state.pickable && this._map) {
        const map = this._map;
        for (const lid of layerIds) {
          // Change cursor on hover
          map.on("mouseenter", lid, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", lid, () => {
            map.getCanvas().style.cursor = "";
          });

          // Show popup on click
          map.on("click", lid, (e) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties || {};

            // Build popup content
            const entries = Object.entries(props);
            if (entries.length === 0) return;

            let html = '<div class="maplibre-gl-add-vector-popup">';
            html += '<table class="maplibre-gl-add-vector-popup-table">';
            for (const [key, value] of entries) {
              html += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
            }
            html += "</table></div>";

            // Close any existing popup first
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

      // Store layer info
      const layerInfo: AddVectorLayerInfo = {
        id: layerId,
        url: this._state.url,
        format,
        sourceId,
        layerIds,
        featureCount: geojson.features.length,
        geometryTypes: Array.from(geometryTypes),
        opacity: this._state.layerOpacity,
        fillColor: this._state.fillColor,
        strokeColor: this._state.strokeColor,
        pickable: this._state.pickable,
      };
      this._vectorLayers.set(layerId, layerInfo);

      this._state.hasLayer = this._vectorLayers.size > 0;
      this._state.layerCount = this._vectorLayers.size;
      this._state.layers = Array.from(this._vectorLayers.values());
      this._state.loading = false;
      this._state.status = `Added ${geojson.features.length} features (${format}).`;

      // Fit bounds if enabled
      if (this._options.fitBounds && geojson.features.length > 0) {
        this._fitToData(geojson);
      }

      this._render();
      this._emit("layeradd", { url: this._state.url, layerId });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
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
      // Assume it's a geometry
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
    // Try direct fetch first
    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) return response;
    } catch {
      // Direct fetch failed, try CORS proxy if configured
    }

    // Try with CORS proxy if configured
    if (this._options.corsProxy) {
      const proxyUrl = this._options.corsProxy + encodeURIComponent(url);
      try {
        const response = await fetch(proxyUrl, { mode: "cors" });
        if (response.ok) return response;
      } catch {
        // Proxy also failed
      }
    }

    // Try with public CORS proxy as last resort
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
      `CORS error: Unable to fetch the file. The server doesn't allow cross-origin requests.`,
    );
  }

  private async _loadGeoParquet(
    url: string,
  ): Promise<GeoJSON.FeatureCollection> {
    // Use DuckDB converter for GeoParquet support (most reliable)
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
    // Dynamically import flatgeobuf geojson module
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

    // Use streaming deserializer from geojson module
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
      const info = this._vectorLayers.get(id);
      if (info) {
        for (const layerId of info.layerIds) {
          try {
            if (this._map.getLayer(layerId)) {
              this._map.removeLayer(layerId);
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
      this._vectorLayers.delete(id);
      this._state.hasLayer = this._vectorLayers.size > 0;
      this._state.layerCount = this._vectorLayers.size;
      this._state.layers = Array.from(this._vectorLayers.values());
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove", { layerId: id });
    } else {
      this._removeAllLayers();
    }
  }

  private _removeAllLayers(): void {
    if (!this._map) return;

    for (const [, info] of this._vectorLayers) {
      for (const layerId of info.layerIds) {
        try {
          if (this._map.getLayer(layerId)) {
            this._map.removeLayer(layerId);
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
    this._vectorLayers.clear();
    this._state.hasLayer = false;
    this._state.layerCount = 0;
    this._state.layers = [];
    this._state.status = null;
    this._state.error = null;
    this._emit("layerremove");
  }
}
