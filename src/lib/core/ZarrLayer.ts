import "../styles/common.css";
import "../styles/zarr-layer.css";
import maplibregl, {
  type IControl,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type {
  ZarrLayerControlOptions,
  ZarrLayerControlState,
  ZarrLayerEvent,
  ZarrLayerEventHandler,
  ZarrLayerInfo,
  ColormapName,
} from "./types";
import { getColormap } from "../colormaps";

/**
 * All available colormap names (same as COG layer).
 */
const COLORMAP_NAMES: ColormapName[] = [
  "bone",
  "bwr",
  "cividis",
  "cool",
  "coolwarm",
  "gray",
  "hot",
  "inferno",
  "jet",
  "magma",
  "ocean",
  "plasma",
  "rainbow",
  "RdBu",
  "RdYlBu",
  "RdYlGn",
  "seismic",
  "spectral",
  "terrain",
  "turbo",
  "viridis",
];

/**
 * Check if a colormap array matches a named colormap.
 */
function findColormapName(colors: string[]): ColormapName | "custom" {
  for (const name of COLORMAP_NAMES) {
    const preset = getColormapColors(name);
    if (JSON.stringify(preset) === JSON.stringify(colors)) {
      return name;
    }
  }
  return "custom";
}

/**
 * Convert colormap stops to array of hex colors for Zarr layer.
 */
function getColormapColors(name: ColormapName): string[] {
  const stops = getColormap(name);
  return stops.map((s) => s.color);
}

/**
 * Zarr/grid icon SVG for the toggle button.
 */
/**
 * 3D cube icon for Zarr layers - represents multi-dimensional array data.
 */
const ZARR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

/**
 * Default options for the ZarrLayerControl.
 */
const DEFAULT_OPTIONS: Required<ZarrLayerControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  beforeId: "",
  defaultUrl: "",
  loadDefaultUrl: false,
  defaultVariable: "",
  defaultColormap: getColormapColors("viridis"),
  defaultClim: [0, 1],
  defaultSelector: {},
  defaultLayerName: "",
  defaultOpacity: 1,
  defaultPickable: true,
  panelWidth: 300,
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
 * A control for adding Zarr layers to the map.
 *
 * Uses @carbonplan/zarr-layer for rendering multi-dimensional Zarr data.
 *
 * @example
 * ```typescript
 * const zarrControl = new ZarrLayerControl({
 *   defaultUrl: 'https://example.com/data.zarr',
 *   defaultVariable: 'temperature',
 *   defaultColormap: ['#440154', '#fde725'],
 *   defaultClim: [0, 30],
 * });
 * map.addControl(zarrControl, 'top-right');
 *
 * zarrControl.on('layeradd', (event) => {
 *   console.log('Zarr layer added:', event.url);
 * });
 * ```
 */
export class ZarrLayerControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<ZarrLayerControlOptions>;
  private _state: ZarrLayerControlState;
  private _eventHandlers: Map<ZarrLayerEvent, Set<ZarrLayerEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _zarrLayers: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _zarrLayerPropsMap: Map<string, Record<string, any>> = new Map();
  private _layerCounter = 0;
  private _activePopup?: maplibregl.Popup;
  private _colormapName: ColormapName | "custom" = "viridis";
  private _customColormap?: string[];
  private _availableVariables: string[] = [];
  private _variablesLoading: boolean = false;

  constructor(options?: ZarrLayerControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };

    // Detect if a custom colormap was provided
    if (options?.defaultColormap) {
      this._colormapName = findColormapName(options.defaultColormap);
      if (this._colormapName === "custom") {
        this._customColormap = options.defaultColormap;
      }
    }

    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      variable: this._options.defaultVariable,
      colormap: this._options.defaultColormap,
      clim: this._options.defaultClim,
      selector: this._options.defaultSelector,
      layerName: this._options.defaultLayerName,
      layerOpacity: this._options.defaultOpacity,
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
    if (
      this._options.loadDefaultUrl &&
      this._options.defaultUrl &&
      this._options.defaultVariable
    ) {
      const loadLayer = () => {
        this._addLayer();
      };
      // Use 'idle' event for more reliable layer loading - ensures style is fully loaded
      if (this._map.isStyleLoaded()) {
        // Small delay to ensure everything is ready
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

  getState(): ZarrLayerControlState {
    return { ...this._state };
  }

  update(options: Partial<ZarrLayerControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  on(event: ZarrLayerEvent, handler: ZarrLayerEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: ZarrLayerEvent, handler: ZarrLayerEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Programmatically add a Zarr layer.
   */
  async addLayer(url?: string, variable?: string): Promise<void> {
    if (url) this._state.url = url;
    if (variable) this._state.variable = variable;
    await this._addLayer();
  }

  /**
   * Programmatically remove a Zarr layer by ID, or all layers if no ID given.
   */
  removeLayer(id?: string): void {
    this._removeLayer(id);
    this._render();
  }

  /**
   * Get all Zarr layer IDs.
   */
  getLayerIds(): string[] {
    return Array.from(this._zarrLayers.keys());
  }

  /**
   * Get the opacity of a specific Zarr layer.
   */
  getLayerOpacity(layerId: string): number | null {
    const layer = this._zarrLayers.get(layerId);
    if (!layer) return null;
    return layer.opacity ?? 1;
  }

  /**
   * Set the opacity of a specific Zarr layer.
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this._zarrLayers.get(layerId);
    if (!layer || typeof layer.setOpacity !== "function") return;

    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    layer.setOpacity(clampedOpacity);

    if (this._map) {
      this._map.triggerRepaint();
    }
  }

  /**
   * Get the visibility of a specific Zarr layer.
   */
  getLayerVisibility(layerId: string): boolean {
    const opacity = this.getLayerOpacity(layerId);
    return opacity !== null && opacity > 0;
  }

  /**
   * Set the visibility of a specific Zarr layer.
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

  /**
   * Get the URL for a specific Zarr layer.
   */
  getLayerUrl(layerId: string): string | null {
    const props = this._zarrLayerPropsMap.get(layerId);
    return (props?.source as string) ?? null;
  }

  /**
   * Get the internal layers map (for adapter use).
   */
  getLayersMap(): Map<string, unknown> {
    return this._zarrLayers;
  }

  /**
   * Fetch available variables from the Zarr store.
   */
  async fetchVariables(): Promise<string[]> {
    if (!this._state.url) return [];

    this._variablesLoading = true;
    this._render();

    try {
      const url = this._state.url.replace(/\/$/, "");

      // Try to fetch .zmetadata (consolidated metadata for Zarr v2)
      try {
        const response = await fetch(`${url}/.zmetadata`);
        if (response.ok) {
          const metadata = await response.json();
          const allPaths = Object.keys(metadata.metadata || {})
            .filter((key) => key.endsWith("/.zarray"))
            .map((key) => key.replace("/.zarray", ""))
            .filter((name) => name && !name.startsWith("."));

          // Extract unique variable names (last part of path, excluding coordinate arrays)
          const coordArrays = new Set([
            "x",
            "y",
            "lat",
            "lon",
            "latitude",
            "longitude",
            "time",
            "band",
            "month",
            "spatial_ref",
          ]);
          const uniqueVars = new Set<string>();

          for (const path of allPaths) {
            // Get the last part of the path (e.g., "5/climate" -> "climate")
            const parts = path.split("/");
            const varName = parts[parts.length - 1];
            // Skip coordinate/dimension arrays, keep data variables
            if (!coordArrays.has(varName)) {
              uniqueVars.add(varName);
            }
          }

          // If no data variables found, fall back to showing all unique names
          let variables = Array.from(uniqueVars);
          if (variables.length === 0) {
            const allNames = new Set<string>();
            for (const path of allPaths) {
              const parts = path.split("/");
              allNames.add(parts[parts.length - 1]);
            }
            variables = Array.from(allNames);
          }

          variables.sort();

          if (variables.length > 0) {
            this._availableVariables = variables;
            this._variablesLoading = false;
            this._render();
            return variables;
          }
        }
      } catch {
        // .zmetadata not available
      }

      // Try to fetch zarr.json (Zarr v3)
      try {
        const response = await fetch(`${url}/zarr.json`);
        if (response.ok) {
          const metadata = await response.json();
          // For Zarr v3, look for node_type: "array" in the root
          if (metadata.node_type === "group") {
            // Need to list contents - this is more complex for v3
            // For now, return empty and let user enter manually
          }
        }
      } catch {
        // zarr.json not available
      }

      // Try to fetch .zgroup and then list directory contents
      try {
        const zgroupResponse = await fetch(`${url}/.zgroup`);
        if (zgroupResponse.ok) {
          // It's a Zarr v2 group but without consolidated metadata
          // We can't easily list contents without server-side directory listing
          // Some servers support this via index.html or directory listing
        }
      } catch {
        // Not a standard Zarr structure
      }

      this._variablesLoading = false;
      this._render();
      return this._availableVariables;
    } catch (error) {
      console.warn("[ZarrLayerControl] Failed to fetch variables:", error);
      this._variablesLoading = false;
      this._render();
      return [];
    }
  }

  private _emit(
    event: ZarrLayerEvent,
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
    container.className = `maplibregl-ctrl maplibre-gl-zarr-layer${
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

    // Save scroll position before clearing content
    const panelEl = this._container.querySelector(
      ".maplibre-gl-zarr-layer-panel",
    );
    const scrollTop = panelEl ? panelEl.scrollTop : 0;

    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }

    this._updateDisplayState();

    // Restore scroll position
    if (scrollTop > 0) {
      const newPanelEl = this._container.querySelector(
        ".maplibre-gl-zarr-layer-panel",
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
    this._button.className = `maplibre-gl-zarr-layer-button${this._state.hasLayer ? " maplibre-gl-zarr-layer-button--active" : ""}`;
    this._button.title = "Zarr Layer";
    this._button.setAttribute("aria-label", "Zarr Layer");
    this._button.innerHTML = ZARR_ICON;
    this._button.addEventListener("click", () => this.expand());

    this._container.appendChild(this._button);
    this._panel = undefined;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-zarr-layer-panel";
    panel.style.width = `${this._options.panelWidth}px`;
    if (this._options.maxHeight && this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }
    this._panel = panel;

    // Header
    const header = document.createElement("div");
    header.className = "maplibre-gl-zarr-layer-header";
    const title = document.createElement("span");
    title.className = "maplibre-gl-zarr-layer-title";
    title.textContent = "Zarr Layer";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-zarr-layer-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // URL input
    const urlGroup = this._createFormGroup("Zarr URL", "url");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.className = "maplibre-gl-zarr-layer-input";
    urlInput.style.color = "#000";
    urlInput.placeholder = "https://example.com/data.zarr";
    urlInput.value = this._state.url;
    urlInput.addEventListener("input", () => {
      this._state.url = urlInput.value;
    });
    urlGroup.appendChild(urlInput);
    panel.appendChild(urlGroup);

    // Variable input with fetch button
    const varGroup = this._createFormGroup("Variable", "variable");
    const varRow = document.createElement("div");
    varRow.className = "maplibre-gl-zarr-layer-var-row";
    varRow.style.display = "flex";
    varRow.style.gap = "6px";

    if (this._availableVariables.length > 0) {
      // Show dropdown if variables are available
      const varSelect = document.createElement("select");
      varSelect.className = "maplibre-gl-zarr-layer-select";
      varSelect.style.color = "#000";
      varSelect.style.flex = "1";

      for (const varName of this._availableVariables) {
        const opt = document.createElement("option");
        opt.value = varName;
        opt.textContent = varName;
        if (varName === this._state.variable) {
          opt.selected = true;
        }
        varSelect.appendChild(opt);
      }
      varSelect.addEventListener("change", () => {
        this._state.variable = varSelect.value;
      });
      varRow.appendChild(varSelect);
    } else {
      // Show text input if no variables fetched yet
      const varInput = document.createElement("input");
      varInput.type = "text";
      varInput.className = "maplibre-gl-zarr-layer-input";
      varInput.style.color = "#000";
      varInput.style.flex = "1";
      varInput.placeholder = "e.g., temperature";
      varInput.value = this._state.variable;
      varInput.addEventListener("input", () => {
        this._state.variable = varInput.value;
      });
      varRow.appendChild(varInput);
    }

    // Fetch button
    const fetchBtn = document.createElement("button");
    fetchBtn.className = "maplibre-gl-zarr-layer-btn";
    fetchBtn.textContent = this._variablesLoading ? "..." : "Fetch";
    fetchBtn.disabled = this._variablesLoading || !this._state.url;
    fetchBtn.style.padding = "5px 10px";
    fetchBtn.style.flexShrink = "0";
    fetchBtn.addEventListener("click", () => this.fetchVariables());
    varRow.appendChild(fetchBtn);

    varGroup.appendChild(varRow);
    panel.appendChild(varGroup);

    // Colormap dropdown
    const cmGroup = this._createFormGroup("Colormap", "colormap");
    const cmSelect = document.createElement("select");
    cmSelect.className = "maplibre-gl-zarr-layer-select";
    cmSelect.style.color = "#000";

    // Add 'custom' option if we have a custom colormap
    if (this._customColormap) {
      const customOpt = document.createElement("option");
      customOpt.value = "custom";
      customOpt.textContent = "custom";
      if (this._colormapName === "custom") {
        customOpt.selected = true;
      }
      cmSelect.appendChild(customOpt);
    }

    for (const name of COLORMAP_NAMES) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === this._colormapName) {
        opt.selected = true;
      }
      cmSelect.appendChild(opt);
    }
    cmSelect.addEventListener("change", () => {
      const value = cmSelect.value;
      if (value === "custom" && this._customColormap) {
        this._colormapName = "custom";
        this._state.colormap = this._customColormap;
      } else {
        this._colormapName = value as ColormapName;
        this._state.colormap = getColormapColors(this._colormapName);
      }
      this._updateColormapPreview();
    });
    cmGroup.appendChild(cmSelect);

    // Colormap preview
    const cmPreview = document.createElement("div");
    cmPreview.className = "maplibre-gl-zarr-layer-colormap-preview";
    cmPreview.id = "zarr-colormap-preview";
    cmPreview.style.background = `linear-gradient(to right, ${this._state.colormap.join(", ")})`;
    cmGroup.appendChild(cmPreview);
    panel.appendChild(cmGroup);

    // Clim min/max row
    const climRow = document.createElement("div");
    climRow.className = "maplibre-gl-zarr-layer-row";
    const minGroup = this._createFormGroup("Clim Min", "clim-min");
    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.className = "maplibre-gl-zarr-layer-input";
    minInput.style.color = "#000";
    minInput.value = String(this._state.clim[0]);
    minInput.addEventListener("input", () => {
      this._state.clim = [Number(minInput.value) || 0, this._state.clim[1]];
    });
    minGroup.appendChild(minInput);
    climRow.appendChild(minGroup);
    const maxGroup = this._createFormGroup("Clim Max", "clim-max");
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.className = "maplibre-gl-zarr-layer-input";
    maxInput.style.color = "#000";
    maxInput.value = String(this._state.clim[1]);
    maxInput.addEventListener("input", () => {
      this._state.clim = [this._state.clim[0], Number(maxInput.value) || 1];
    });
    maxGroup.appendChild(maxInput);
    climRow.appendChild(maxGroup);
    panel.appendChild(climRow);

    // Selector input (JSON)
    const selectorGroup = this._createFormGroup("Selector (JSON)", "selector");
    const selectorInput = document.createElement("input");
    selectorInput.type = "text";
    selectorInput.className = "maplibre-gl-zarr-layer-input";
    selectorInput.style.color = "#000";
    selectorInput.placeholder = '{"time": 0, "band": "prec"}';
    selectorInput.value = this._state.selector
      ? JSON.stringify(this._state.selector)
      : "";
    selectorInput.addEventListener("input", () => {
      try {
        const parsed = selectorInput.value
          ? JSON.parse(selectorInput.value)
          : {};
        this._state.selector = parsed;
      } catch {
        // Invalid JSON, ignore
      }
    });
    selectorGroup.appendChild(selectorInput);
    panel.appendChild(selectorGroup);

    // Opacity slider
    const opacityGroup = this._createFormGroup("Opacity", "opacity");
    const sliderRow = document.createElement("div");
    sliderRow.className = "maplibre-gl-zarr-layer-slider-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "maplibre-gl-zarr-layer-slider";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round(this._state.layerOpacity * 100));
    const sliderValue = document.createElement("span");
    sliderValue.className = "maplibre-gl-zarr-layer-slider-value";
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
    pickableGroup.className =
      "maplibre-gl-zarr-layer-form-group maplibre-gl-zarr-layer-checkbox-group";
    const pickableLabel = document.createElement("label");
    pickableLabel.className = "maplibre-gl-zarr-layer-checkbox-label";
    const pickableCheckbox = document.createElement("input");
    pickableCheckbox.type = "checkbox";
    pickableCheckbox.className = "maplibre-gl-zarr-layer-checkbox";
    pickableCheckbox.checked = this._state.pickable;
    pickableCheckbox.addEventListener("change", () => {
      this._state.pickable = pickableCheckbox.checked;
      this._updatePickable();
    });
    pickableLabel.appendChild(pickableCheckbox);
    const pickableLabelText = document.createElement("span");
    pickableLabelText.textContent = "Pickable (click to show pixel value)";
    pickableLabel.appendChild(pickableLabelText);
    pickableGroup.appendChild(pickableLabel);
    panel.appendChild(pickableGroup);

    // Layer name input
    const layerNameGroup = this._createFormGroup("Layer Name", "layer-name");
    const layerNameInput = document.createElement("input");
    layerNameInput.type = "text";
    layerNameInput.className = "maplibre-gl-zarr-layer-input";
    layerNameInput.style.color = "#000";
    layerNameInput.placeholder = "Optional custom layer name";
    layerNameInput.value = this._state.layerName;
    layerNameInput.addEventListener("input", () => {
      this._state.layerName = layerNameInput.value;
    });
    layerNameGroup.appendChild(layerNameInput);
    panel.appendChild(layerNameGroup);

    // Before ID input (for layer ordering)
    const beforeIdGroup = this._createFormGroup(
      "Before Layer ID (optional)",
      "before-id",
    );
    const beforeIdInput = document.createElement("input");
    beforeIdInput.type = "text";
    beforeIdInput.className = "maplibre-gl-zarr-layer-input";
    beforeIdInput.style.color = "#000";
    beforeIdInput.placeholder = "e.g. labels or water";
    beforeIdInput.value = this._options.beforeId || "";
    beforeIdInput.addEventListener("input", () => {
      this._options.beforeId = beforeIdInput.value || "";
    });
    beforeIdGroup.appendChild(beforeIdInput);
    panel.appendChild(beforeIdGroup);

    // Buttons
    const btns = document.createElement("div");
    btns.className = "maplibre-gl-zarr-layer-buttons";

    const addBtn = document.createElement("button");
    addBtn.className =
      "maplibre-gl-zarr-layer-btn maplibre-gl-zarr-layer-btn--primary";
    addBtn.textContent = "Add Layer";
    addBtn.disabled = this._state.loading;
    addBtn.addEventListener("click", () => this._addLayer());
    btns.appendChild(addBtn);

    panel.appendChild(btns);

    // Status/error area
    if (this._state.loading) {
      this._appendStatus("Loading Zarr...", "info");
    } else if (this._state.error) {
      this._appendStatus(this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(this._state.status, "success");
    }

    // Layer list
    if (this._zarrLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-zarr-layer-list";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-zarr-layer-list-header";
      listHeader.textContent = `Layers (${this._zarrLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [layerId] of this._zarrLayers) {
        const props = this._zarrLayerPropsMap.get(layerId);
        if (!props) continue;

        const item = document.createElement("div");
        item.className = "maplibre-gl-zarr-layer-list-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-zarr-layer-list-label";
        const url = props.source as string;
        const variable = props.variable as string;
        const customName = props._layerName as string | undefined;
        let displayName: string;
        if (customName) {
          displayName = customName;
        } else {
          displayName = variable || layerId;
          try {
            const urlObj = new URL(url);
            displayName = `${urlObj.pathname.split("/").pop()} / ${variable}`;
          } catch {
            displayName = `${url} / ${variable}`;
          }
        }
        label.textContent = displayName;
        label.title = `${url} (${variable})`;
        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-zarr-layer-list-remove";
        removeBtn.innerHTML = "&times;";
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
    this._button = undefined;
  }

  private _createFormGroup(labelText: string, id: string): HTMLElement {
    const group = document.createElement("div");
    group.className = "maplibre-gl-zarr-layer-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `zarr-layer-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    message: string,
    type: "info" | "error" | "success",
  ): void {
    if (!this._panel) return;
    const status = document.createElement("div");
    status.className = `maplibre-gl-zarr-layer-status maplibre-gl-zarr-layer-status--${type}`;
    status.textContent = message;
    this._panel.appendChild(status);
  }

  private _updateColormapPreview(): void {
    const preview = document.getElementById("zarr-colormap-preview");
    if (preview) {
      preview.style.background = `linear-gradient(to right, ${this._state.colormap.join(", ")})`;
    }
  }

  private async _addLayer(): Promise<void> {
    if (!this._map || !this._state.url || !this._state.variable) {
      this._state.error = "Please enter a Zarr URL and variable name.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      const { ZarrLayer } = await import("@carbonplan/zarr-layer");

      // Generate unique layer ID
      const layerId = `zarr-layer-${this._layerCounter++}`;

      // Build layer options
      const layerOptions = {
        id: layerId,
        source: this._state.url,
        variable: this._state.variable,
        colormap: this._state.colormap,
        clim: this._state.clim as [number, number],
        opacity: this._state.layerOpacity,
        selector:
          this._state.selector && Object.keys(this._state.selector).length > 0
            ? this._state.selector
            : undefined,
      };

      // Store props for adapter use
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layerProps: Record<string, any> = { ...layerOptions };
      // Store custom layer name if provided
      const customName = this._state.layerName?.trim();
      if (customName) {
        layerProps._layerName = customName;
      }
      this._zarrLayerPropsMap.set(layerId, layerProps);

      const newLayer = new ZarrLayer(layerOptions);
      this._zarrLayers.set(layerId, newLayer);
      // Add layer with optional beforeId for layer ordering (only if layer exists)
      let beforeId: string | undefined;
      if (this._options.beforeId) {
        if (this._map.getLayer(this._options.beforeId)) {
          beforeId = this._options.beforeId;
        } else {
          console.warn(
            `[ZarrLayerControl] beforeId "${this._options.beforeId}" not found in map layers, adding layer on top`,
          );
        }
      }
      if (beforeId) {
        this._map.addLayer(newLayer, beforeId);
      } else {
        this._map.addLayer(newLayer);
      }

      // Set up pickable click handler if enabled
      if (this._state.pickable) {
        this._setupLayerClickHandler(layerId);
      }

      this._state.hasLayer = this._zarrLayers.size > 0;
      this._state.layerCount = this._zarrLayers.size;
      this._state.layers = this._buildLayerInfoList();
      this._state.loading = false;
      this._state.status = "Zarr layer added successfully.";
      this._state.layerName = "";
      this._render();
      this._emit("layeradd", { url: this._state.url, layerId });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load Zarr: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit("error", { error: this._state.error });
    }
  }

  private _setupLayerClickHandler(layerId: string): void {
    if (!this._map) return;
    const map = this._map;
    const props = this._zarrLayerPropsMap.get(layerId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clickHandler = (e: any) => {
      if (!this._state.pickable) return;

      // Close existing popup
      if (this._activePopup) {
        this._activePopup.remove();
      }

      const { lngLat } = e;

      let html = '<div class="maplibre-gl-zarr-layer-popup">';
      html += '<table class="maplibre-gl-zarr-layer-popup-table">';
      html += `<tr><td><strong>Layer</strong></td><td>${layerId}</td></tr>`;
      html += `<tr><td><strong>Variable</strong></td><td>${props?.variable || "N/A"}</td></tr>`;
      html += `<tr><td><strong>Lng</strong></td><td>${lngLat.lng.toFixed(6)}</td></tr>`;
      html += `<tr><td><strong>Lat</strong></td><td>${lngLat.lat.toFixed(6)}</td></tr>`;
      if (props?.clim) {
        html += `<tr><td><strong>Color Range</strong></td><td>${props.clim[0]} - ${props.clim[1]}</td></tr>`;
      }
      if (props?.source) {
        html += `<tr><td><strong>Source</strong></td><td style="word-break:break-all;max-width:150px;">${props.source.split("/").pop()}</td></tr>`;
      }
      html += "</table>";
      html += "</div>";

      this._activePopup = new maplibregl.Popup({
        closeButton: true,
        maxWidth: "250px",
      })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map);

      // Ensure popup is above any overlay layers
      const popupEl = this._activePopup.getElement();
      if (popupEl) {
        popupEl.style.zIndex = "1000";
      }
    };

    // Store handler reference for cleanup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this._zarrLayers.get(layerId) as any)._clickHandler = clickHandler;
    map.on("click", clickHandler);
  }

  private _updatePickable(): void {
    // Pickable state is checked in click handler, no layer rebuild needed
  }

  private _removeLayer(id?: string): void {
    if (!this._map) return;

    if (id) {
      // Remove a specific layer
      const layer = this._zarrLayers.get(id);
      if (layer) {
        try {
          this._map.removeLayer(id);
        } catch {
          // Layer may already be removed
        }
      }
      this._zarrLayers.delete(id);
      this._zarrLayerPropsMap.delete(id);
      this._state.hasLayer = this._zarrLayers.size > 0;
      this._state.layerCount = this._zarrLayers.size;
      this._state.layers = this._buildLayerInfoList();
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove", { layerId: id });
    } else {
      // Remove all layers (cleanup)
      for (const [layerId] of this._zarrLayers) {
        try {
          this._map.removeLayer(layerId);
        } catch {
          // Layer may already be removed
        }
      }
      this._zarrLayers.clear();
      this._zarrLayerPropsMap.clear();
      this._state.hasLayer = false;
      this._state.layerCount = 0;
      this._state.layers = [];
      this._state.status = null;
      this._state.error = null;
      this._emit("layerremove");
    }
  }

  private _updateOpacity(): void {
    if (this._zarrLayers.size === 0) return;
    const opacity = this._state.layerOpacity;
    for (const [, layer] of this._zarrLayers) {
      if (typeof layer.setOpacity === "function") {
        layer.setOpacity(opacity);
      }
    }
    if (this._map) {
      this._map.triggerRepaint();
    }
  }

  private _buildLayerInfoList(): ZarrLayerInfo[] {
    const list: ZarrLayerInfo[] = [];
    for (const [layerId, props] of this._zarrLayerPropsMap) {
      list.push({
        id: layerId,
        name: (props._layerName as string) || undefined,
        url: props.source as string,
        variable: props.variable as string,
        colormap: props.colormap as string[],
        clim: props.clim as [number, number],
        selector: props.selector as Record<string, number | string> | undefined,
        opacity: (props.opacity as number) ?? 1,
      });
    }
    return list;
  }
}
