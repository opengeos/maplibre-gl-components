import "../styles/common.css";
import "../styles/pmtiles-layer.css";
import {
  type IControl,
  type Map as MapLibreMap,
  type MapMouseEvent,
  Popup,
} from "maplibre-gl";
import type {
  PMTilesLayerControlOptions,
  PMTilesLayerControlState,
  PMTilesLayerEvent,
  PMTilesLayerEventHandler,
  PMTilesLayerInfo,
  PMTilesTileType,
} from "./types";

/**
 * Grid/tiles icon - represents tiled map data in PMTiles format.
 */
const PMTILES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`;

/**
 * Default options for the PMTilesLayerControl.
 */
const DEFAULT_OPTIONS: Required<PMTilesLayerControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  beforeId: "",
  defaultUrl: "",
  loadDefaultUrl: false,
  defaultOpacity: 1,
  defaultFillColor: "steelblue",
  defaultLineColor: "#333333",
  defaultCircleColor: "steelblue",
  defaultPickable: true,
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
 * A control for adding PMTiles layers to the map.
 *
 * Supports both vector and raster PMTiles files.
 *
 * @example
 * ```typescript
 * const pmtilesControl = new PMTilesLayerControl({
 *   defaultUrl: 'https://example.com/tiles.pmtiles',
 *   loadDefaultUrl: true,
 * });
 * map.addControl(pmtilesControl, 'top-right');
 *
 * pmtilesControl.on('layeradd', (event) => {
 *   console.log('PMTiles layer added:', event.url);
 * });
 * ```
 */
export class PMTilesLayerControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<PMTilesLayerControlOptions>;
  private _state: PMTilesLayerControlState;
  private _eventHandlers: Map<
    PMTilesLayerEvent,
    Set<PMTilesLayerEventHandler>
  > = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _pmtilesLayers: Map<string, PMTilesLayerInfo> = new Map();
  private _layerCounter = 0;
  private _protocolRegistered = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _protocol?: any;
  private _popup?: Popup;
  private _clickHandler?: (e: MapMouseEvent) => void;

  constructor(options?: PMTilesLayerControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      layerOpacity: this._options.defaultOpacity,
      availableSourceLayers: [],
      selectedSourceLayers: [],
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

    // Set up click handler for pickable features
    this._setupClickHandler();

    // Auto-load default URL if specified
    if (this._options.loadDefaultUrl && this._options.defaultUrl) {
      const loadLayer = () => {
        this._addLayer();
      };
      // Use 'idle' event for more reliable layer loading
      if (this._map.isStyleLoaded()) {
        setTimeout(loadLayer, 100);
      } else {
        this._map.once("idle", loadLayer);
      }
    }

    return this._container;
  }

  onRemove(): void {
    this._removeLayer(); // Remove all layers on cleanup

    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }

    // Clean up click handler
    if (this._map && this._clickHandler) {
      this._map.off("click", this._clickHandler);
      this._clickHandler = undefined;
    }

    // Clean up popup
    if (this._popup) {
      this._popup.remove();
      this._popup = undefined;
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

  getState(): PMTilesLayerControlState {
    return { ...this._state };
  }

  update(options: Partial<PMTilesLayerControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  on(event: PMTilesLayerEvent, handler: PMTilesLayerEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: PMTilesLayerEvent, handler: PMTilesLayerEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Programmatically add a PMTiles layer.
   */
  async addLayer(url?: string): Promise<void> {
    if (url) this._state.url = url;
    await this._addLayer();
  }

  /**
   * Programmatically remove a PMTiles layer by ID, or all layers if no ID given.
   */
  removeLayer(id?: string): void {
    this._removeLayer(id);
    this._render();
  }

  /**
   * Get all PMTiles layer IDs.
   */
  getLayerIds(): string[] {
    const ids: string[] = [];
    for (const info of this._pmtilesLayers.values()) {
      ids.push(...info.layerIds);
    }
    return ids;
  }

  /**
   * Find the source info that contains a specific layer ID.
   */
  private _findSourceByLayerId(layerId: string): PMTilesLayerInfo | undefined {
    for (const info of this._pmtilesLayers.values()) {
      if (info.layerIds.includes(layerId)) {
        return info;
      }
    }
    return undefined;
  }

  /**
   * Get the opacity of a layer (by layer ID or source ID).
   */
  getLayerOpacity(id: string): number | null {
    // Check if it's a source ID first
    let info = this._pmtilesLayers.get(id);
    // If not found, check if it's a layer ID
    if (!info) {
      info = this._findSourceByLayerId(id);
    }
    return info?.opacity ?? null;
  }

  /**
   * Set the opacity of a layer (by layer ID or source ID).
   * If layer ID is provided, sets opacity for that specific layer.
   * If source ID is provided, sets opacity for all layers from that source.
   */
  setLayerOpacity(id: string, opacity: number): void {
    if (!this._map) return;
    const clampedOpacity = Math.max(0, Math.min(1, opacity));

    // Check if it's a source ID
    const sourceInfo = this._pmtilesLayers.get(id);
    if (sourceInfo) {
      // Set opacity for all layers in the source
      sourceInfo.opacity = clampedOpacity;
      for (const layerId of sourceInfo.layerIds) {
        this._setLayerOpacityDirect(layerId, clampedOpacity);
      }
      return;
    }

    // Check if it's a layer ID
    const info = this._findSourceByLayerId(id);
    if (info) {
      // Set opacity for this specific layer only
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
      this._map.setPaintProperty(layerId, "fill-opacity", opacity * 0.6);
    } else if (type === "line") {
      this._map.setPaintProperty(layerId, "line-opacity", opacity);
    } else if (type === "circle") {
      this._map.setPaintProperty(layerId, "circle-opacity", opacity);
    } else if (type === "raster") {
      this._map.setPaintProperty(layerId, "raster-opacity", opacity);
    }
  }

  /**
   * Get the visibility of a layer (by layer ID or source ID).
   */
  getLayerVisibility(id: string): boolean {
    if (!this._map) return false;

    // Check if it's a source ID
    const sourceInfo = this._pmtilesLayers.get(id);
    if (sourceInfo && sourceInfo.layerIds.length > 0) {
      const visibility = this._map.getLayoutProperty(
        sourceInfo.layerIds[0],
        "visibility",
      );
      return visibility !== "none";
    }

    // Check if it's a layer ID
    const info = this._findSourceByLayerId(id);
    if (info) {
      const visibility = this._map.getLayoutProperty(id, "visibility");
      return visibility !== "none";
    }

    return false;
  }

  /**
   * Set the visibility of a layer (by layer ID or source ID).
   * If layer ID is provided, sets visibility for that specific layer.
   * If source ID is provided, sets visibility for all layers from that source.
   */
  setLayerVisibility(id: string, visible: boolean): void {
    if (!this._map) return;

    // Check if it's a source ID
    const sourceInfo = this._pmtilesLayers.get(id);
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

    // Check if it's a layer ID
    const info = this._findSourceByLayerId(id);
    if (info) {
      this._map.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none",
      );
    }
  }

  /**
   * Get the URL for a specific PMTiles source.
   */
  getLayerUrl(sourceId: string): string | null {
    const info = this._pmtilesLayers.get(sourceId);
    return info?.url ?? null;
  }

  /**
   * Get whether features are pickable (clickable) globally or for a specific source.
   */
  getPickable(sourceId?: string): boolean {
    if (sourceId) {
      const info = this._pmtilesLayers.get(sourceId);
      return info?.pickable ?? this._state.pickable;
    }
    return this._state.pickable;
  }

  /**
   * Set whether features are pickable (clickable).
   * If sourceId is provided, sets pickable for that specific source.
   * If no sourceId, sets the global pickable state for all current and future layers.
   */
  setPickable(pickable: boolean, sourceId?: string): void {
    if (sourceId) {
      const info = this._pmtilesLayers.get(sourceId);
      if (info) {
        info.pickable = pickable;
      }
    } else {
      this._state.pickable = pickable;
      // Update all existing layers
      for (const info of this._pmtilesLayers.values()) {
        info.pickable = pickable;
      }
    }
    this._render();
  }

  private _emit(
    event: PMTilesLayerEvent,
    extra?: { url?: string; error?: string; layerId?: string },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), ...extra };
      handlers.forEach((h) => h(payload));
    }
  }

  private _setupClickHandler(): void {
    if (!this._map) return;

    this._clickHandler = (e: MapMouseEvent) => {
      if (!this._map || !this._state.pickable) return;

      // Get all layer IDs from pickable sources
      const pickableLayerIds: string[] = [];
      for (const info of this._pmtilesLayers.values()) {
        if (info.pickable && info.tileType === "vector") {
          pickableLayerIds.push(...info.layerIds);
        }
      }

      if (pickableLayerIds.length === 0) return;

      // Query features at click point
      const features = this._map.queryRenderedFeatures(e.point, {
        layers: pickableLayerIds,
      });

      if (features.length === 0) {
        // Close popup if clicking on empty area
        if (this._popup) {
          this._popup.remove();
        }
        return;
      }

      // Get the first feature
      const feature = features[0];
      const properties = feature.properties || {};

      // Build popup content
      let html = '<div class="maplibre-gl-pmtiles-popup">';
      html += `<div class="maplibre-gl-pmtiles-popup-header">${feature.sourceLayer || "Feature"}</div>`;
      html += '<div class="maplibre-gl-pmtiles-popup-content">';

      const propEntries = Object.entries(properties);
      if (propEntries.length === 0) {
        html +=
          '<div class="maplibre-gl-pmtiles-popup-empty">No properties</div>';
      } else {
        html += '<table class="maplibre-gl-pmtiles-popup-table">';
        for (const [key, value] of propEntries) {
          const displayValue =
            typeof value === "object" ? JSON.stringify(value) : String(value);
          html += `<tr><td class="maplibre-gl-pmtiles-popup-key">${key}</td><td class="maplibre-gl-pmtiles-popup-value">${displayValue}</td></tr>`;
        }
        html += "</table>";
      }

      html += "</div></div>";

      // Show popup
      if (!this._popup) {
        this._popup = new Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: "320px",
        });
      }

      this._popup.setLngLat(e.lngLat).setHTML(html).addTo(this._map);
    };

    this._map.on("click", this._clickHandler);
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
    container.className = `maplibregl-ctrl maplibre-gl-pmtiles-layer${
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
    this._button.className = `maplibre-gl-pmtiles-layer-button${this._state.hasLayer ? " maplibre-gl-pmtiles-layer-button--active" : ""}`;
    this._button.title = "PMTiles Layer";
    this._button.setAttribute("aria-label", "PMTiles Layer");
    this._button.innerHTML = PMTILES_ICON;
    this._button.addEventListener("click", () => this.expand());

    this._container.appendChild(this._button);
    this._panel = undefined;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-pmtiles-layer-panel";
    panel.style.width = `${this._options.panelWidth}px`;
    this._panel = panel;

    // Header
    const header = document.createElement("div");
    header.className = "maplibre-gl-pmtiles-layer-header";
    const title = document.createElement("span");
    title.className = "maplibre-gl-pmtiles-layer-title";
    title.textContent = "PMTiles Layer";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-pmtiles-layer-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // URL input
    const urlGroup = this._createFormGroup("PMTiles URL", "url");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.className = "maplibre-gl-pmtiles-layer-input";
    urlInput.placeholder = "https://example.com/tiles.pmtiles";
    urlInput.value = this._state.url;
    urlInput.addEventListener("input", () => {
      this._state.url = urlInput.value;
    });
    urlGroup.appendChild(urlInput);
    panel.appendChild(urlGroup);

    // Opacity slider
    const opacityGroup = this._createFormGroup("Opacity", "opacity");
    const sliderRow = document.createElement("div");
    sliderRow.className = "maplibre-gl-pmtiles-layer-slider-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "maplibre-gl-pmtiles-layer-slider";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round(this._state.layerOpacity * 100));
    const sliderValue = document.createElement("span");
    sliderValue.className = "maplibre-gl-pmtiles-layer-slider-value";
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

    // Pickable checkbox
    const pickableGroup = this._createFormGroup("Interactivity", "pickable");
    const pickableRow = document.createElement("div");
    pickableRow.style.display = "flex";
    pickableRow.style.alignItems = "center";
    pickableRow.style.gap = "6px";

    const pickableCheckbox = document.createElement("input");
    pickableCheckbox.type = "checkbox";
    pickableCheckbox.id = "pmtiles-layer-pickable";
    pickableCheckbox.checked = this._state.pickable;
    pickableCheckbox.addEventListener("change", () => {
      this.setPickable(pickableCheckbox.checked);
    });

    const pickableLabel = document.createElement("label");
    pickableLabel.htmlFor = "pmtiles-layer-pickable";
    pickableLabel.textContent = "Enable feature picking (click to inspect)";
    pickableLabel.style.fontSize = "12px";
    pickableLabel.style.cursor = "pointer";

    pickableRow.appendChild(pickableCheckbox);
    pickableRow.appendChild(pickableLabel);
    pickableGroup.appendChild(pickableRow);
    panel.appendChild(pickableGroup);

    // Source layers section with Fetch button
    const sourceLayersGroup = this._createFormGroup(
      "Source Layers",
      "source-layers",
    );

    // Fetch button row
    const fetchRow = document.createElement("div");
    fetchRow.style.display = "flex";
    fetchRow.style.gap = "6px";
    fetchRow.style.alignItems = "center";
    fetchRow.style.marginBottom = "6px";

    const fetchBtn = document.createElement("button");
    fetchBtn.className = "maplibre-gl-pmtiles-layer-btn";
    fetchBtn.textContent = "Fetch";
    fetchBtn.style.padding = "4px 10px";
    fetchBtn.style.fontSize = "11px";
    fetchBtn.style.whiteSpace = "nowrap";
    fetchBtn.disabled = !this._state.url;
    fetchBtn.addEventListener("click", () => this._fetchSourceLayers());
    fetchRow.appendChild(fetchBtn);

    if (this._state.availableSourceLayers.length > 0) {
      // All/None buttons
      const allBtn = document.createElement("button");
      allBtn.className = "maplibre-gl-pmtiles-layer-btn";
      allBtn.textContent = "All";
      allBtn.style.padding = "4px 8px";
      allBtn.style.fontSize = "11px";
      allBtn.addEventListener("click", () => {
        this._state.selectedSourceLayers = [
          ...this._state.availableSourceLayers,
        ];
        this._render();
      });
      fetchRow.appendChild(allBtn);

      const noneBtn = document.createElement("button");
      noneBtn.className = "maplibre-gl-pmtiles-layer-btn";
      noneBtn.textContent = "None";
      noneBtn.style.padding = "4px 8px";
      noneBtn.style.fontSize = "11px";
      noneBtn.addEventListener("click", () => {
        this._state.selectedSourceLayers = [];
        this._render();
      });
      fetchRow.appendChild(noneBtn);

      const countLabel = document.createElement("span");
      countLabel.style.fontSize = "11px";
      countLabel.style.color = "#666";
      countLabel.textContent = `(${this._state.selectedSourceLayers.length}/${this._state.availableSourceLayers.length})`;
      fetchRow.appendChild(countLabel);
    }

    sourceLayersGroup.appendChild(fetchRow);

    if (this._state.availableSourceLayers.length > 0) {
      // Collapsible panel for layer checkboxes
      const layersPanel = document.createElement("div");
      layersPanel.style.maxHeight = "120px";
      layersPanel.style.overflowY = "auto";
      layersPanel.style.border = "1px solid #ddd";
      layersPanel.style.borderRadius = "3px";
      layersPanel.style.padding = "6px";
      layersPanel.style.background = "#fafafa";

      // Show checkboxes for each available layer
      for (const layerName of this._state.availableSourceLayers) {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "4px";
        label.style.fontSize = "11px";
        label.style.cursor = "pointer";
        label.style.padding = "2px 0";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = this._state.selectedSourceLayers.includes(layerName);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            if (!this._state.selectedSourceLayers.includes(layerName)) {
              this._state.selectedSourceLayers.push(layerName);
            }
          } else {
            this._state.selectedSourceLayers =
              this._state.selectedSourceLayers.filter((l) => l !== layerName);
          }
          this._render();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(layerName));
        layersPanel.appendChild(label);
      }

      sourceLayersGroup.appendChild(layersPanel);
    } else if (!this._state.loading) {
      const hint = document.createElement("span");
      hint.style.fontSize = "11px";
      hint.style.color = "#888";
      hint.textContent = "Click Fetch to discover available layers";
      sourceLayersGroup.appendChild(hint);
    }

    panel.appendChild(sourceLayersGroup);

    // Before ID input (for layer ordering)
    const beforeIdGroup = this._createFormGroup(
      "Before Layer ID (optional)",
      "before-id",
    );
    const beforeIdInput = document.createElement("input");
    beforeIdInput.type = "text";
    beforeIdInput.className = "maplibre-gl-pmtiles-layer-input";
    beforeIdInput.placeholder = "e.g. labels or water";
    beforeIdInput.value = this._options.beforeId || "";
    beforeIdInput.addEventListener("input", () => {
      this._options.beforeId = beforeIdInput.value || "";
    });
    beforeIdGroup.appendChild(beforeIdInput);
    panel.appendChild(beforeIdGroup);

    // Buttons
    const btns = document.createElement("div");
    btns.className = "maplibre-gl-pmtiles-layer-buttons";

    const addBtn = document.createElement("button");
    addBtn.className =
      "maplibre-gl-pmtiles-layer-btn maplibre-gl-pmtiles-layer-btn--primary";
    addBtn.textContent = "Add Layer";
    addBtn.disabled = this._state.loading;
    addBtn.addEventListener("click", () => this._addLayer());
    btns.appendChild(addBtn);

    panel.appendChild(btns);

    // Status/error area
    if (this._state.loading) {
      this._appendStatus("Loading PMTiles...", "info");
    } else if (this._state.error) {
      this._appendStatus(this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(this._state.status, "success");
    }

    // Layer list
    if (this._pmtilesLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-pmtiles-layer-list";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-pmtiles-layer-list-header";
      listHeader.textContent = `Layers (${this._pmtilesLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [sourceId, info] of this._pmtilesLayers) {
        const item = document.createElement("div");
        item.className = "maplibre-gl-pmtiles-layer-list-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-pmtiles-layer-list-label";
        let displayName: string;
        try {
          const urlObj = new URL(info.url);
          displayName = urlObj.pathname.split("/").pop() || info.url;
        } catch {
          displayName = info.url;
        }
        label.textContent = displayName;
        label.title = info.url;

        // Add badge for tile type
        const badge = document.createElement("span");
        badge.className = `maplibre-gl-pmtiles-layer-badge${info.tileType === "raster" ? " maplibre-gl-pmtiles-layer-badge--raster" : ""}`;
        badge.textContent = info.tileType;
        label.appendChild(badge);

        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-pmtiles-layer-list-remove";
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
    group.className = "maplibre-gl-pmtiles-layer-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `pmtiles-layer-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    message: string,
    type: "info" | "error" | "success",
  ): void {
    if (!this._panel) return;
    const status = document.createElement("div");
    status.className = `maplibre-gl-pmtiles-layer-status maplibre-gl-pmtiles-layer-status--${type}`;
    status.textContent = message;
    this._panel.appendChild(status);
  }

  private async _ensureProtocol(): Promise<void> {
    if (this._protocolRegistered) return;

    // Dynamically import pmtiles
    const pmtiles = await import("pmtiles");
    this._protocol = new pmtiles.Protocol();

    // Register the protocol with MapLibre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maplibregl =
      (window as any).maplibregl || (await import("maplibre-gl"));
    if (!maplibregl.config?.REGISTERED_PROTOCOLS?.pmtiles) {
      maplibregl.addProtocol("pmtiles", this._protocol.tile);
    }

    this._protocolRegistered = true;
  }

  private async _fetchSourceLayers(): Promise<void> {
    if (!this._state.url) {
      this._state.error = "Please enter a PMTiles URL.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      await this._ensureProtocol();

      const pmtiles = await import("pmtiles");
      const p = new pmtiles.PMTiles(this._state.url);
      this._protocol.add(p);

      const header = await p.getHeader();
      const metadata = await p.getMetadata();

      // Check if vector tiles
      if (header.tileType === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vectorLayers = (metadata as any)?.vector_layers || [];
        const sourceLayers: string[] = vectorLayers.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (l: any) => l.id as string,
        );

        this._state.availableSourceLayers = sourceLayers;
        // Select all by default
        this._state.selectedSourceLayers = [...sourceLayers];
        this._state.status = `Found ${sourceLayers.length} source layer(s)`;
      } else {
        this._state.availableSourceLayers = [];
        this._state.selectedSourceLayers = [];
        this._state.status = "Raster tiles (no source layers)";
      }

      this._state.loading = false;
      this._render();
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
    }
  }

  private async _addLayer(): Promise<void> {
    if (!this._map || !this._state.url) {
      this._state.error = "Please enter a PMTiles URL.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      await this._ensureProtocol();

      const pmtiles = await import("pmtiles");

      // Create PMTiles instance to get header info
      const p = new pmtiles.PMTiles(this._state.url);
      this._protocol.add(p);

      const header = await p.getHeader();
      const metadata = await p.getMetadata();

      // Determine tile type
      let tileType: PMTilesTileType = "unknown";
      if (header.tileType === 1) {
        tileType = "vector";
      } else if (
        header.tileType === 2 ||
        header.tileType === 3 ||
        header.tileType === 4
      ) {
        tileType = "raster";
      }

      // Generate unique source ID
      const sourceId = `pmtiles-source-${this._layerCounter++}`;

      // Add source
      const pmtilesUrl = `pmtiles://${this._state.url}`;

      if (tileType === "vector") {
        this._map.addSource(sourceId, {
          type: "vector",
          url: pmtilesUrl,
        });
      } else {
        this._map.addSource(sourceId, {
          type: "raster",
          url: pmtilesUrl,
          tileSize: 256,
        });
      }

      // Get source layers from metadata (for vector tiles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vectorLayers = (metadata as any)?.vector_layers || [];
      const sourceLayers: string[] = vectorLayers.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l: any) => l.id as string,
      );

      const layerIds: string[] = [];
      const beforeId =
        this._options.beforeId && this._map.getLayer(this._options.beforeId)
          ? this._options.beforeId
          : undefined;

      if (tileType === "vector") {
        // Use selected source layers if available, otherwise use all
        const layersToRender =
          this._state.selectedSourceLayers.length > 0
            ? this._state.selectedSourceLayers
            : sourceLayers;

        // Add layers for each source layer
        for (const sourceLayer of layersToRender) {
          // Determine layer type based on geometry (simplified - add all types)
          const fillLayerId = `${sourceId}-${sourceLayer}-fill`;
          const lineLayerId = `${sourceId}-${sourceLayer}-line`;
          const circleLayerId = `${sourceId}-${sourceLayer}-circle`;

          // Add fill layer
          this._map.addLayer(
            {
              id: fillLayerId,
              type: "fill",
              source: sourceId,
              "source-layer": sourceLayer,
              paint: {
                "fill-color": this._options.defaultFillColor,
                "fill-opacity": this._state.layerOpacity * 0.6,
              },
              filter: ["==", ["geometry-type"], "Polygon"],
            },
            beforeId,
          );
          layerIds.push(fillLayerId);

          // Add line layer
          this._map.addLayer(
            {
              id: lineLayerId,
              type: "line",
              source: sourceId,
              "source-layer": sourceLayer,
              paint: {
                "line-color": this._options.defaultLineColor,
                "line-opacity": this._state.layerOpacity,
                "line-width": 1,
              },
              filter: [
                "in",
                ["geometry-type"],
                ["literal", ["LineString", "Polygon"]],
              ],
            },
            beforeId,
          );
          layerIds.push(lineLayerId);

          // Add circle layer for points
          this._map.addLayer(
            {
              id: circleLayerId,
              type: "circle",
              source: sourceId,
              "source-layer": sourceLayer,
              paint: {
                "circle-color": this._options.defaultCircleColor,
                "circle-opacity": this._state.layerOpacity,
                "circle-radius": 4,
              },
              filter: ["==", ["geometry-type"], "Point"],
            },
            beforeId,
          );
          layerIds.push(circleLayerId);
        }

        // If no source layers found, try adding a generic layer
        if (layersToRender.length === 0) {
          const genericLayerId = `${sourceId}-generic`;
          this._map.addLayer(
            {
              id: genericLayerId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": this._options.defaultFillColor,
                "fill-opacity": this._state.layerOpacity * 0.6,
              },
            },
            beforeId,
          );
          layerIds.push(genericLayerId);
        }
      } else {
        // Add raster layer
        const rasterLayerId = `${sourceId}-raster`;
        this._map.addLayer(
          {
            id: rasterLayerId,
            type: "raster",
            source: sourceId,
            paint: {
              "raster-opacity": this._state.layerOpacity,
            },
          },
          beforeId,
        );
        layerIds.push(rasterLayerId);
      }

      // Fit bounds if we have center info
      if (header.centerLon !== undefined && header.centerLat !== undefined) {
        this._map.flyTo({
          center: [header.centerLon, header.centerLat],
          zoom: Math.min(header.maxZoom - 2, 14),
          duration: 1000,
        });
      }

      // Store layer info
      const layerInfo: PMTilesLayerInfo = {
        id: sourceId,
        url: this._state.url,
        tileType,
        sourceLayers,
        layerIds,
        opacity: this._state.layerOpacity,
        pickable: this._state.pickable,
      };
      this._pmtilesLayers.set(sourceId, layerInfo);

      this._state.hasLayer = this._pmtilesLayers.size > 0;
      this._state.layerCount = this._pmtilesLayers.size;
      this._state.layers = Array.from(this._pmtilesLayers.values());
      this._state.loading = false;
      this._state.status = `PMTiles layer added (${tileType}).`;
      this._render();
      this._emit("layeradd", { url: this._state.url, layerId: sourceId });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load PMTiles: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
  }

  private _removeLayer(id?: string): void {
    if (!this._map) return;

    if (id) {
      // Remove a specific source and its layers
      const info = this._pmtilesLayers.get(id);
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
          if (this._map.getSource(id)) {
            this._map.removeSource(id);
          }
        } catch {
          // Source may already be removed
        }
      }
      this._pmtilesLayers.delete(id);
      this._state.hasLayer = this._pmtilesLayers.size > 0;
      this._state.layerCount = this._pmtilesLayers.size;
      this._state.layers = Array.from(this._pmtilesLayers.values());
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove", { layerId: id });
    } else {
      // Remove all layers (cleanup)
      for (const [sourceId, info] of this._pmtilesLayers) {
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
          if (this._map.getSource(sourceId)) {
            this._map.removeSource(sourceId);
          }
        } catch {
          // ignore
        }
      }
      this._pmtilesLayers.clear();
      this._state.hasLayer = false;
      this._state.layerCount = 0;
      this._state.layers = [];
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove");
    }
  }

  private _updateOpacity(): void {
    for (const [sourceId] of this._pmtilesLayers) {
      this.setLayerOpacity(sourceId, this._state.layerOpacity);
    }
  }
}
