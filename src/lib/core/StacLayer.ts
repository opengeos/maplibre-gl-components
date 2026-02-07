import "../styles/common.css";
import "../styles/stac-layer.css";
import maplibregl, { type IControl, type Map as MapLibreMap } from "maplibre-gl";
import type {
  StacLayerControlOptions,
  StacLayerControlState,
  StacLayerEvent,
  StacLayerEventHandler,
  StacAssetInfo,
  ColormapName,
  ControlPosition,
} from "./types";
import { getColormap } from "../colormaps";

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
  defaultOpacity: 1,
  defaultPickable: true,
  panelWidth: 320,
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

  private _emit(
    event: StacLayerEvent,
    extra?: { url?: string; error?: string; layerId?: string; assetKey?: string },
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
    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
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
    urlInput.placeholder = "https://example.com/stac-item.json";
    urlInput.value = this._state.stacUrl;
    urlInput.addEventListener("input", () => {
      this._state.stacUrl = urlInput.value;
    });
    urlGroup.appendChild(urlInput);

    // Fetch button
    const fetchBtn = document.createElement("button");
    fetchBtn.className = "maplibre-gl-stac-layer-btn maplibre-gl-stac-layer-btn--secondary";
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
      modeGroup.className = "maplibre-gl-stac-layer-form-group maplibre-gl-stac-layer-mode-toggle";

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

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select an asset --";
        assetSelect.appendChild(defaultOption);

        for (const asset of this._state.assets) {
          const option = document.createElement("option");
          option.value = asset.key;
          option.textContent = asset.title || asset.key;
          option.selected = this._state.selectedAsset === asset.key;
          assetSelect.appendChild(option);
        }

        assetSelect.addEventListener("change", () => {
          this._state.selectedAsset = assetSelect.value || null;
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
          channelLabel.style.color = i === 0 ? "#d32f2f" : i === 1 ? "#388e3c" : "#1976d2";
          row.appendChild(channelLabel);

          const select = document.createElement("select");
          select.className = "maplibre-gl-stac-layer-select maplibre-gl-stac-layer-rgb-select";

          const defaultOpt = document.createElement("option");
          defaultOpt.value = "";
          defaultOpt.textContent = "-- Select --";
          select.appendChild(defaultOpt);

          for (const asset of this._state.assets) {
            const opt = document.createElement("option");
            opt.value = asset.key;
            opt.textContent = asset.title || asset.key;
            opt.selected = this._state.rgbAssets[i] === asset.key;
            select.appendChild(opt);
          }

          const idx = i;
          select.addEventListener("change", () => {
            this._state.rgbAssets[idx] = select.value || null;
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
      minInput.className = "maplibre-gl-stac-layer-input maplibre-gl-stac-layer-input--half";
      minInput.placeholder = "Min";
      minInput.value = String(this._state.rescaleMin);
      minInput.addEventListener("input", () => {
        this._state.rescaleMin = Number(minInput.value) || 0;
      });

      const maxInput = document.createElement("input");
      maxInput.type = "number";
      maxInput.className = "maplibre-gl-stac-layer-input maplibre-gl-stac-layer-input--half";
      maxInput.placeholder = "Max";
      maxInput.value = String(this._state.rescaleMax);
      maxInput.addEventListener("input", () => {
        this._state.rescaleMax = Number(maxInput.value) || 255;
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

      // Pickable checkbox
      const pickableGroup = document.createElement("div");
      pickableGroup.className = "maplibre-gl-stac-layer-form-group maplibre-gl-stac-layer-checkbox-group";
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
      addBtn.className = "maplibre-gl-stac-layer-btn maplibre-gl-stac-layer-btn--primary";
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
        <div><strong>Date:</strong> ${this._state.stacItem.properties?.datetime || 'N/A'}</div>
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
        label.textContent = layerId;
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

  private _updateColormapPreview(): void {
    const preview = this._colormapPreview;
    if (!preview) return;

    if (this._state.colormap === "none") {
      preview.style.display = "none";
      return;
    }

    const colors = getColormap(this._state.colormap as ColormapName);
    if (colors && colors.length > 0) {
      const gradient = colors.join(", ");
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
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const stacItem = await response.json();

      // Validate it's a STAC item
      if (stacItem.type !== "Feature" || !stacItem.assets) {
        throw new Error("Invalid STAC item: missing 'type: Feature' or 'assets'");
      }

      this._state.stacItem = stacItem;

      // Extract COG assets
      const assets: StacAssetInfo[] = [];
      for (const [key, asset] of Object.entries(stacItem.assets)) {
        const assetObj = asset as { href: string; type?: string; title?: string };
        // Filter for COG/GeoTIFF assets
        if (
          assetObj.type?.includes("geotiff") ||
          assetObj.type?.includes("image/tiff") ||
          assetObj.href?.endsWith(".tif") ||
          assetObj.href?.endsWith(".tiff")
        ) {
          assets.push({
            key,
            href: assetObj.href,
            type: assetObj.type || "image/tiff",
            title: assetObj.title || key,
          });
        }
      }

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

      this._activePopup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
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
        this._patchCOGLayer(COGLayer);

        // For RGB composite, we load each band separately and combine
        const layerId = `stac-${this._state.stacItem?.id || "layer"}-rgb-${this._layerCounter++}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layerProps: Record<string, any> = {
          id: layerId,
          geotiff: [rAsset.href, gAsset.href, bAsset.href],
          opacity: this._state.layerOpacity,
          pickable: this._state.pickable,
          _rescaleMin: this._state.rescaleMin,
          _rescaleMax: this._state.rescaleMax,
          _isRgb: true,
        };

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
        this._state.status = `Added RGB layer: ${r}, ${g}, ${b}`;
        this._render();
        this._emit("layeradd", { layerId, assetKey: `${r},${g},${b}`, url: rAsset.href });
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

    const asset = this._state.assets.find((a) => a.key === this._state.selectedAsset);
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
      this._render();
      this._emit("layeradd", { layerId, assetKey: asset.key, url: asset.href });
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
   * Patch COGLayer to handle grayscale and float GeoTIFFs.
   * The upstream library has limited support for these formats.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _patchCOGLayer(COGLayerClass: any): void {
    // Guard: only patch once
    if (COGLayerClass.__stacPatched) return;
    COGLayerClass.__stacPatched = true;

    const originalParseGeoTIFF = COGLayerClass.prototype._parseGeoTIFF;

    COGLayerClass.prototype._parseGeoTIFF = async function () {
      try {
        await originalParseGeoTIFF.call(this);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        // Handle unsupported PhotometricInterpretation or float data
        if (
          !msg.includes("PhotometricInterpretation") &&
          !msg.includes("non-unsigned integers")
        ) {
          throw err;
        }

        // Custom fallback for grayscale/float data
        const { fromUrl } = await import("geotiff");
        const { parseCOGTileMatrixSet, texture } =
          await import("@developmentseed/deck.gl-geotiff");
        const { CreateTexture } =
          await import("@developmentseed/deck.gl-raster/gpu-modules");

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

        const SamplesPerPixel = image.getSamplesPerPixel();
        const BitsPerSample = image.getBitsPerSample();
        const SampleFormat = image.getSampleFormat();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadTile = async (options: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const device = (this as any).context.device;
          const overviewIndex = options.overview ?? 0;
          const geotiffImage = images[overviewIndex] ?? image;

          const rasterData = await geotiffImage.readRasters({
            ...options,
            interleave: true,
          });

          let data = rasterData;
          let numSamples = SamplesPerPixel;

          // Expand single-band grayscale to RGBA
          if (SamplesPerPixel === 1) {
            const pixelCount = rasterData.width * rasterData.height;
            const rgba = new Float32Array(pixelCount * 4);
            for (let i = 0; i < pixelCount; i++) {
              const val = rasterData[i];
              rgba[i * 4] = val;
              rgba[i * 4 + 1] = val;
              rgba[i * 4 + 2] = val;
              rgba[i * 4 + 3] = 1.0;
            }
            data = rgba;
            (data as { width?: number; height?: number }).width = rasterData.width;
            (data as { width?: number; height?: number }).height = rasterData.height;
            numSamples = 4;
          }

          const textureFormat = texture.inferTextureFormat(
            numSamples,
            BitsPerSample,
            SampleFormat,
          );
          const tex = device.createTexture({
            data,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderTile = (tileData: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pipeline: any[] = [
            {
              module: CreateTexture,
              props: { textureName: tileData.texture },
            },
          ];
          return pipeline;
        };

        self._cogState = {
          geotiff,
          metadata,
          loadTile,
          renderTile,
        };
      }
    };
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
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return async (geoKeys: any) => {
        try {
          const result = geoKeysToProj4.toProj4(geoKeys);
          if (result && result.proj4) {
            const proj4Module = await import("proj4");
            const proj4Fn = proj4Module.default || proj4Module;
            let parsed: Record<string, unknown> = {};
            if (typeof proj4Fn === "function") {
              try {
                proj4Fn.defs("custom", result.proj4);
                parsed =
                  (proj4Fn.defs("custom") as unknown as Record<
                    string,
                    unknown
                  >) || {};
              } catch {
                // ignore proj4 parsing errors
              }
            }
            return {
              def: result.proj4 as string,
              parsed,
              coordinatesUnits: (result.coordinatesUnits as string) || "metre",
            };
          }
        } catch {
          // Fall back to default parser
        }
        return null;
      };
    } catch {
      // geotiff-geokeys-to-proj4 not available
      return null;
    }
  }
}
