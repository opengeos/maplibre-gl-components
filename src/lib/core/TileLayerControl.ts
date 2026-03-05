import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  TileLayerControlOptions,
  TileLayerControlState,
  TileLayerEvent,
  TileLayerEventData,
  TileLayerEventHandler,
  TileLayerInfo,
  TileLayerType,
} from "./types";

/**
 * Default options for the TileLayerControl.
 */
const DEFAULT_OPTIONS: Required<TileLayerControlOptions> = {
  collapsed: true,
  defaultType: "xyz",
  defaultUrl: "",
  defaultWmsUrl: "https://services.terrascope.be/wms/v2",
  defaultName: "",
  defaultWmsLayers: "",
  defaultOpacity: 0.8,
  tileSize: 256,
  attribution: "",
};

/**
 * SVG icon: image with plus sign, representing adding tile imagery.
 */
const TILE_LAYER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M2 15l10 5 10-5"/></svg>`;

/**
 * SVG eye icon for visibility toggle.
 */
const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

/**
 * SVG eye-off icon for hidden layers.
 */
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

/**
 * A control that lets users add XYZ or WMS raster tile layers to the map
 * by entering a URL and optionally customizing the layer name.
 *
 * @example
 * ```typescript
 * const tileControl = new TileLayerControl({ defaultUrl: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' });
 * map.addControl(tileControl, 'top-right');
 *
 * tileControl.on('layeradd', (e) => console.log('Added:', e.layer?.name));
 * ```
 */
export class TileLayerControl implements IControl {
  private _map?: MapLibreMap;
  private _container?: HTMLElement;
  _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<TileLayerControlOptions>;
  private _collapsed: boolean;
  private _layers: TileLayerInfo[] = [];
  private _layerCounter = 0;
  private _eventHandlers: Map<TileLayerEvent, Set<TileLayerEventHandler>> =
    new Map();

  // DOM refs for the panel form
  private _typeSelect?: HTMLSelectElement;
  private _urlInput?: HTMLInputElement;
  private _nameInput?: HTMLInputElement;
  private _wmsLayersSelect?: HTMLSelectElement;
  private _wmsLayersRow?: HTMLElement;
  private _wmsStatusEl?: HTMLElement;
  private _opacityInput?: HTMLInputElement;
  private _opacityValueEl?: HTMLElement;
  private _layerListEl?: HTMLElement;
  private _fetchDebounceTimer?: ReturnType<typeof setTimeout>;
  private _fetchController?: AbortController;

  constructor(options?: TileLayerControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._collapsed = this._options.collapsed;
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className =
      "maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-tile-layer-control";

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.title = "Tile Layer";
    this._button.setAttribute("aria-label", "Tile Layer");
    this._button.innerHTML = TILE_LAYER_ICON;
    this._button.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:29px;height:29px;cursor:pointer;";
    this._button.addEventListener("click", () => this._togglePanel());

    this._container.appendChild(this._button);

    if (!this._collapsed) {
      this._showPanel();
    }

    return this._container;
  }

  onRemove(): void {
    // Remove all layers from map
    if (this._map) {
      for (const layer of [...this._layers]) {
        try {
          if (this._map.getLayer(layer.id)) this._map.removeLayer(layer.id);
          if (this._map.getSource(layer.id)) this._map.removeSource(layer.id);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    this._layers = [];

    this._fetchController?.abort();
    clearTimeout(this._fetchDebounceTimer);
    this._container?.parentNode?.removeChild(this._container);
    this._map = undefined;
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._typeSelect = undefined;
    this._urlInput = undefined;
    this._nameInput = undefined;
    this._wmsLayersSelect = undefined;
    this._wmsLayersRow = undefined;
    this._wmsStatusEl = undefined;
    this._opacityInput = undefined;
    this._opacityValueEl = undefined;
    this._layerListEl = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Add a raster tile layer to the map.
   */
  addTileLayer(
    url: string,
    options?: {
      name?: string;
      type?: TileLayerType;
      wmsLayers?: string;
      opacity?: number;
    },
  ): TileLayerInfo | null {
    if (!this._map || !url.trim()) return null;

    ++this._layerCounter;
    const type = options?.type ?? this._options.defaultType;
    const opacity = options?.opacity ?? this._options.defaultOpacity;
    const name = options?.name || `Tile Layer ${this._layerCounter}`;
    // Use the layer name as the MapLibre source/layer ID so it shows
    // correctly in external layer controls. Append counter if duplicate.
    let id = name;
    if (this._map.getSource(id) || this._layers.some((l) => l.id === id)) {
      id = `${name}-${this._layerCounter}`;
    }

    // Build the final tile URL
    let tileUrl = url;
    if (type === "wms") {
      tileUrl = this._buildWmsUrl(url, options?.wmsLayers);
    }

    const info: TileLayerInfo = {
      id,
      name,
      url,
      type,
      opacity,
      visible: true,
      wmsLayers: options?.wmsLayers,
    };

    try {
      this._map.addSource(id, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: this._options.tileSize,
        ...(this._options.attribution
          ? { attribution: this._options.attribution }
          : {}),
      });

      this._map.addLayer({
        id,
        type: "raster",
        source: id,
        paint: { "raster-opacity": opacity },
      });
    } catch (e) {
      console.error("Failed to add tile layer:", e);
      return null;
    }

    this._layers.push(info);
    this._updateLayerList();
    this._emit("layeradd", info);
    return info;
  }

  /**
   * Remove a tile layer from the map by ID.
   */
  removeTileLayer(id: string): void {
    const idx = this._layers.findIndex((l) => l.id === id);
    if (idx === -1 || !this._map) return;

    const layer = this._layers[idx];
    try {
      if (this._map.getLayer(id)) this._map.removeLayer(id);
      if (this._map.getSource(id)) this._map.removeSource(id);
    } catch {
      // ignore
    }

    this._layers.splice(idx, 1);
    this._updateLayerList();
    this._emit("layerremove", layer);
  }

  /**
   * Toggle visibility of a tile layer.
   */
  setLayerVisibility(id: string, visible: boolean): void {
    const layer = this._layers.find((l) => l.id === id);
    if (!layer || !this._map) return;

    layer.visible = visible;
    this._map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    this._updateLayerList();
    this._emit("layervisibility", layer);
  }

  /**
   * Set the opacity of a tile layer.
   */
  setLayerOpacity(id: string, opacity: number): void {
    const layer = this._layers.find((l) => l.id === id);
    if (!layer || !this._map) return;

    layer.opacity = opacity;
    this._map.setPaintProperty(id, "raster-opacity", opacity);
    this._emit("layeropacity", layer);
  }

  /**
   * Get all currently added tile layers.
   */
  getLayers(): TileLayerInfo[] {
    return [...this._layers];
  }

  /**
   * Get the current control state.
   */
  getState(): TileLayerControlState {
    return { collapsed: this._collapsed, layers: [...this._layers] };
  }

  /**
   * Expand the settings panel.
   */
  expand(): void {
    if (!this._collapsed) return;
    this._collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  /**
   * Collapse the settings panel.
   */
  collapse(): void {
    if (this._collapsed) return;
    this._collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  /**
   * Register an event handler.
   */
  on(event: TileLayerEvent, handler: TileLayerEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler.
   */
  off(event: TileLayerEvent, handler: TileLayerEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private _togglePanel(): void {
    if (this._collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  private _showPanel(): void {
    if (!this._panel && this._container) {
      this._panel = this._createPanel();
      this._container.appendChild(this._panel);
    }
    this._button?.classList.add("active");
  }

  private _hidePanel(): void {
    this._fetchController?.abort();
    clearTimeout(this._fetchDebounceTimer);
    this._panel?.remove();
    this._panel = undefined;
    this._typeSelect = undefined;
    this._urlInput = undefined;
    this._nameInput = undefined;
    this._wmsLayersSelect = undefined;
    this._wmsLayersRow = undefined;
    this._wmsStatusEl = undefined;
    this._opacityInput = undefined;
    this._opacityValueEl = undefined;
    this._layerListEl = undefined;
    this._button?.classList.remove("active");
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "tile-layer-panel";
    panel.style.cssText =
      "position:absolute;top:0;right:calc(100% + 0px);background:#fff;color:#000;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:12px;z-index:1;white-space:nowrap;min-width:280px;";

    // Header
    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600;font-size:13px;color:#000;";
    header.textContent = "Tile Layer";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00d7";
    closeBtn.style.cssText =
      "background:none;border:none;font-size:18px;cursor:pointer;color:#000;padding:0 0 0 8px;line-height:1;";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const rowStyle =
      "display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:#000;";
    const labelStyle = "flex-shrink:0;font-weight:500;min-width:70px;";
    const inputStyle =
      "flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;color:#000;background:#fff;";

    // Type select
    const typeRow = document.createElement("div");
    typeRow.style.cssText = rowStyle;
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type";
    typeLabel.style.cssText = labelStyle;
    this._typeSelect = document.createElement("select");
    this._typeSelect.style.cssText =
      "flex:1;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;color:#000;background:#fff;cursor:pointer;";
    const xyzOpt = document.createElement("option");
    xyzOpt.value = "xyz";
    xyzOpt.textContent = "XYZ";
    const wmsOpt = document.createElement("option");
    wmsOpt.value = "wms";
    wmsOpt.textContent = "WMS";
    this._typeSelect.appendChild(xyzOpt);
    this._typeSelect.appendChild(wmsOpt);
    this._typeSelect.value = this._options.defaultType;
    this._typeSelect.addEventListener("change", () => {
      const isWms = this._typeSelect!.value === "wms";
      if (this._wmsLayersRow) {
        this._wmsLayersRow.style.display = isWms ? "flex" : "none";
      }
      if (this._urlInput) {
        this._urlInput.placeholder = isWms
          ? "https://example.com/wms"
          : "https://.../{z}/{x}/{y}.png";
        // Swap URL field between XYZ and WMS defaults
        if (isWms && !this._urlInput.value.trim()) {
          this._urlInput.value = this._options.defaultWmsUrl;
        } else if (
          isWms &&
          this._urlInput.value === this._options.defaultUrl
        ) {
          this._urlInput.value = this._options.defaultWmsUrl;
        } else if (
          !isWms &&
          this._urlInput.value === this._options.defaultWmsUrl
        ) {
          this._urlInput.value = this._options.defaultUrl;
        }
      }
      if (isWms) this._onWmsUrlChange();
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(this._typeSelect);
    panel.appendChild(typeRow);

    // URL input
    const urlRow = document.createElement("div");
    urlRow.style.cssText = rowStyle;
    const urlLabel = document.createElement("label");
    urlLabel.textContent = "URL";
    urlLabel.style.cssText = labelStyle;
    this._urlInput = document.createElement("input");
    this._urlInput.type = "text";
    this._urlInput.placeholder =
      this._options.defaultType === "wms"
        ? "https://example.com/wms"
        : "https://.../{z}/{x}/{y}.png";
    this._urlInput.value = this._options.defaultUrl;
    this._urlInput.style.cssText = inputStyle;
    this._urlInput.addEventListener("input", () => this._onWmsUrlChange());
    this._urlInput.addEventListener("change", () => this._onWmsUrlChange());
    urlRow.appendChild(urlLabel);
    urlRow.appendChild(this._urlInput);
    panel.appendChild(urlRow);

    // Name input
    const nameRow = document.createElement("div");
    nameRow.style.cssText = rowStyle;
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    nameLabel.style.cssText = labelStyle;
    this._nameInput = document.createElement("input");
    this._nameInput.type = "text";
    this._nameInput.placeholder = "Layer name (optional)";
    this._nameInput.value = this._options.defaultName;
    this._nameInput.style.cssText = inputStyle;
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(this._nameInput);
    panel.appendChild(nameRow);

    // WMS Layers dropdown (hidden by default for XYZ)
    this._wmsLayersRow = document.createElement("div");
    this._wmsLayersRow.style.cssText =
      "display:flex;flex-direction:column;gap:4px;margin-bottom:8px;font-size:12px;color:#000;";
    this._wmsLayersRow.style.display =
      this._options.defaultType === "wms" ? "flex" : "none";

    const wmsSelectRow = document.createElement("div");
    wmsSelectRow.style.cssText =
      "display:flex;align-items:center;gap:8px;";
    const wmsLabel = document.createElement("label");
    wmsLabel.textContent = "Layer";
    wmsLabel.style.cssText = labelStyle;
    this._wmsLayersSelect = document.createElement("select");
    this._wmsLayersSelect.style.cssText =
      "flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;color:#000;background:#fff;cursor:pointer;";
    // Add default placeholder option
    const placeholderOpt = document.createElement("option");
    placeholderOpt.value = "";
    placeholderOpt.textContent = "Enter WMS URL first...";
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    this._wmsLayersSelect.appendChild(placeholderOpt);

    // If a default WMS layers value is set, add it as an option
    if (this._options.defaultWmsLayers) {
      const opt = document.createElement("option");
      opt.value = this._options.defaultWmsLayers;
      opt.textContent = this._options.defaultWmsLayers;
      this._wmsLayersSelect.appendChild(opt);
      this._wmsLayersSelect.value = this._options.defaultWmsLayers;
    }

    // Auto-fill name when WMS layer is selected
    this._wmsLayersSelect.addEventListener("change", () => {
      if (this._nameInput) {
        const selected =
          this._wmsLayersSelect!.options[this._wmsLayersSelect!.selectedIndex];
        if (selected?.textContent) {
          this._nameInput.value = selected.textContent;
        }
      }
    });

    wmsSelectRow.appendChild(wmsLabel);
    wmsSelectRow.appendChild(this._wmsLayersSelect);
    this._wmsLayersRow.appendChild(wmsSelectRow);

    // Status indicator for fetch progress
    this._wmsStatusEl = document.createElement("div");
    this._wmsStatusEl.style.cssText =
      "font-size:11px;color:#888;padding-left:78px;display:none;";
    this._wmsLayersRow.appendChild(this._wmsStatusEl);

    panel.appendChild(this._wmsLayersRow);

    // Trigger initial fetch if default URL is set and type is WMS
    if (this._options.defaultType === "wms" && this._options.defaultUrl) {
      this._onWmsUrlChange();
    }

    // Opacity slider
    const opacityRow = document.createElement("div");
    opacityRow.style.cssText = rowStyle;
    const opacityLabel = document.createElement("label");
    opacityLabel.textContent = "Opacity";
    opacityLabel.style.cssText = labelStyle;
    this._opacityInput = document.createElement("input");
    this._opacityInput.type = "range";
    this._opacityInput.min = "0";
    this._opacityInput.max = "1";
    this._opacityInput.step = "0.05";
    this._opacityInput.value = String(this._options.defaultOpacity);
    this._opacityInput.style.cssText =
      "flex:1;min-width:80px;cursor:pointer;accent-color:#2563eb;";
    this._opacityValueEl = document.createElement("span");
    this._opacityValueEl.textContent = `${this._options.defaultOpacity}`;
    this._opacityValueEl.style.cssText =
      "min-width:28px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;";
    this._opacityInput.addEventListener("input", () => {
      if (this._opacityValueEl) {
        this._opacityValueEl.textContent = `${this._opacityInput!.value}`;
      }
    });
    opacityRow.appendChild(opacityLabel);
    opacityRow.appendChild(this._opacityInput);
    opacityRow.appendChild(this._opacityValueEl);
    panel.appendChild(opacityRow);

    // Add Layer button
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add Layer";
    addBtn.style.cssText =
      "width:100%;padding:6px 0;border:1px solid #333;border-radius:4px;background:#fff;font-size:12px;font-weight:500;color:#000;cursor:pointer;margin-bottom:8px;";
    addBtn.addEventListener("mouseenter", () => {
      addBtn.style.backgroundColor = "#f0f0f0";
    });
    addBtn.addEventListener("mouseleave", () => {
      addBtn.style.backgroundColor = "#fff";
    });
    addBtn.addEventListener("click", () => this._addLayerFromForm());
    panel.appendChild(addBtn);

    // Layer list container
    this._layerListEl = document.createElement("div");
    this._layerListEl.style.cssText = "max-height:200px;overflow-y:auto;";
    this._updateLayerList();
    panel.appendChild(this._layerListEl);

    return panel;
  }

  private _addLayerFromForm(): void {
    const url = this._urlInput?.value.trim();
    if (!url) {
      if (this._urlInput) {
        this._urlInput.style.borderColor = "#e74c3c";
        setTimeout(() => {
          if (this._urlInput) this._urlInput.style.borderColor = "#ccc";
        }, 2000);
      }
      return;
    }

    const type = (this._typeSelect?.value ?? "xyz") as TileLayerType;
    const name = this._nameInput?.value.trim() || undefined;
    const wmsLayers = this._wmsLayersSelect?.value.trim() || undefined;
    const opacity = Number(this._opacityInput?.value ?? 0.8);

    this.addTileLayer(url, { name, type, wmsLayers, opacity });
  }

  private _updateLayerList(): void {
    if (!this._layerListEl) return;
    this._layerListEl.innerHTML = "";

    if (this._layers.length === 0) return;

    const header = document.createElement("div");
    header.style.cssText =
      "font-size:11px;font-weight:600;color:#666;margin-bottom:4px;padding-top:4px;border-top:1px solid #eee;";
    header.textContent = "Added Layers";
    this._layerListEl.appendChild(header);

    for (const layer of this._layers) {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:4px;margin-bottom:4px;font-size:11px;color:#000;";

      // Visibility toggle
      const visBtn = document.createElement("button");
      visBtn.type = "button";
      visBtn.title = layer.visible ? "Hide layer" : "Show layer";
      visBtn.innerHTML = layer.visible ? EYE_ICON : EYE_OFF_ICON;
      visBtn.style.cssText =
        "background:none;border:none;cursor:pointer;padding:2px;display:flex;align-items:center;flex-shrink:0;color:#000;";
      if (!layer.visible) visBtn.style.opacity = "0.4";
      visBtn.addEventListener("click", () => {
        this.setLayerVisibility(layer.id, !layer.visible);
      });
      row.appendChild(visBtn);

      // Layer name
      const nameEl = document.createElement("span");
      nameEl.textContent = layer.name;
      nameEl.title = layer.url;
      nameEl.style.cssText =
        "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;";
      row.appendChild(nameEl);

      // Per-layer opacity slider
      const opSlider = document.createElement("input");
      opSlider.type = "range";
      opSlider.min = "0";
      opSlider.max = "1";
      opSlider.step = "0.05";
      opSlider.value = String(layer.opacity);
      opSlider.style.cssText =
        "width:50px;cursor:pointer;accent-color:#2563eb;flex-shrink:0;";
      opSlider.addEventListener("input", () => {
        this.setLayerOpacity(layer.id, Number(opSlider.value));
      });
      row.appendChild(opSlider);

      // Remove button
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.title = "Remove layer";
      removeBtn.textContent = "\u00d7";
      removeBtn.style.cssText =
        "background:none;border:none;font-size:14px;cursor:pointer;color:#999;padding:0 2px;line-height:1;flex-shrink:0;";
      removeBtn.addEventListener("mouseenter", () => {
        removeBtn.style.color = "#e74c3c";
      });
      removeBtn.addEventListener("mouseleave", () => {
        removeBtn.style.color = "#999";
      });
      removeBtn.addEventListener("click", () => {
        this.removeTileLayer(layer.id);
      });
      row.appendChild(removeBtn);

      this._layerListEl.appendChild(row);
    }
  }

  /**
   * Debounced handler for WMS URL changes. Fetches layer list when type is WMS.
   */
  private _onWmsUrlChange(): void {
    if (this._typeSelect?.value !== "wms") return;
    clearTimeout(this._fetchDebounceTimer);
    this._fetchDebounceTimer = setTimeout(() => {
      const url = this._urlInput?.value.trim();
      if (url) {
        this._fetchWmsLayers(url);
      }
    }, 600);
  }

  /**
   * Fetch WMS GetCapabilities and populate the layer dropdown.
   */
  private async _fetchWmsLayers(baseUrl: string): Promise<void> {
    this._fetchController?.abort();
    this._fetchController = new AbortController();

    if (this._wmsStatusEl) {
      this._wmsStatusEl.style.display = "block";
      this._wmsStatusEl.textContent = "Fetching layers...";
      this._wmsStatusEl.style.color = "#888";
    }

    try {
      const capUrl = new URL(baseUrl);
      capUrl.searchParams.set("service", "WMS");
      capUrl.searchParams.set("request", "GetCapabilities");

      const resp = await fetch(capUrl.toString(), {
        signal: this._fetchController.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const text = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      // Extract layer names and titles from the capabilities document
      const layers: { name: string; title: string }[] = [];
      const layerEls = doc.querySelectorAll("Layer");
      for (const el of layerEls) {
        const nameEl = el.querySelector(":scope > Name");
        const titleEl = el.querySelector(":scope > Title");
        if (nameEl?.textContent) {
          layers.push({
            name: nameEl.textContent,
            title: titleEl?.textContent || nameEl.textContent,
          });
        }
      }

      if (!this._wmsLayersSelect) return;

      // Clear existing options
      this._wmsLayersSelect.innerHTML = "";

      if (layers.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No layers found";
        opt.disabled = true;
        opt.selected = true;
        this._wmsLayersSelect.appendChild(opt);
        if (this._wmsStatusEl) {
          this._wmsStatusEl.textContent = "No layers found";
          this._wmsStatusEl.style.color = "#e74c3c";
        }
        return;
      }

      // Add placeholder
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = `Select a layer (${layers.length} available)`;
      placeholder.disabled = true;
      placeholder.selected = true;
      this._wmsLayersSelect.appendChild(placeholder);

      // Add layer options
      for (const layer of layers) {
        const opt = document.createElement("option");
        opt.value = layer.name;
        opt.textContent =
          layer.title !== layer.name
            ? `${layer.title} (${layer.name})`
            : layer.name;
        this._wmsLayersSelect.appendChild(opt);
      }

      // Pre-select if defaultWmsLayers matches
      if (this._options.defaultWmsLayers) {
        const match = layers.find(
          (l) => l.name === this._options.defaultWmsLayers,
        );
        if (match) this._wmsLayersSelect.value = match.name;
      }

      if (this._wmsStatusEl) {
        this._wmsStatusEl.textContent = `${layers.length} layers available`;
        this._wmsStatusEl.style.color = "#22c55e";
        setTimeout(() => {
          if (this._wmsStatusEl) this._wmsStatusEl.style.display = "none";
        }, 3000);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (this._wmsStatusEl) {
        this._wmsStatusEl.textContent = "Failed to fetch layers";
        this._wmsStatusEl.style.color = "#e74c3c";
      }
    }
  }

  /**
   * Build a full WMS GetMap URL template from a base WMS endpoint and layers.
   * If the URL already contains `{bbox-epsg-3857}` it is returned as-is.
   */
  private _buildWmsUrl(baseUrl: string, wmsLayers?: string): string {
    if (baseUrl.includes("{bbox-epsg-3857}")) return baseUrl;

    const url = new URL(baseUrl);
    const params = url.searchParams;

    // Set required WMS GetMap parameters (only if not already present)
    if (!params.has("service")) params.set("service", "WMS");
    if (!params.has("request")) params.set("request", "GetMap");
    if (!params.has("version")) params.set("version", "1.1.1");
    if (wmsLayers && !params.has("layers")) params.set("layers", wmsLayers);
    if (!params.has("styles")) params.set("styles", "");
    if (!params.has("format")) params.set("format", "image/png");
    if (!params.has("transparent")) params.set("transparent", "true");
    if (!params.has("width")) params.set("width", "256");
    if (!params.has("height")) params.set("height", "256");
    if (!params.has("srs")) params.set("srs", "EPSG:3857");

    // Append the bbox placeholder (must not be URL-encoded)
    return `${url.toString()}&bbox={bbox-epsg-3857}`;
  }

  private _emit(event: TileLayerEvent, layer?: TileLayerInfo): void {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;
    const data: TileLayerEventData = {
      type: event,
      state: this.getState(),
      layer,
    };
    handlers.forEach((handler) => handler(data));
  }
}
