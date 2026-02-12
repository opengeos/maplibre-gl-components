import "../styles/common.css";
import "../styles/basemap.css";
import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  BasemapControlOptions,
  BasemapControlState,
  BasemapItem,
  BasemapEvent,
  ComponentEvent,
} from "./types";
import {
  XYZSERVICES_URL,
  parseProviders,
  buildTileUrl,
  groupBasemaps,
  filterBasemaps,
  GOOGLE_BASEMAPS,
} from "../utils/providers";

/**
 * Event handler type for basemap events.
 */
type BasemapEventHandler = (event: {
  type: BasemapEvent;
  state: BasemapControlState;
  basemap?: BasemapItem;
}) => void;

/**
 * Default options for the BasemapControl.
 */
const DEFAULT_OPTIONS: Required<
  Omit<
    BasemapControlOptions,
    "basemaps" | "filterGroups" | "excludeGroups" | "beforeId"
  >
> & {
  basemaps: BasemapItem[];
  filterGroups: string[] | undefined;
  excludeGroups: string[] | undefined;
  beforeId: string | undefined;
} = {
  basemaps: [],
  providersUrl: XYZSERVICES_URL,
  defaultBasemap: "",
  position: "top-right",
  className: "",
  visible: true,
  collapsible: true,
  collapsed: true,
  displayMode: "dropdown",
  showSearch: true,
  filterGroups: undefined,
  excludeGroups: undefined,
  excludeBroken: true,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  maxWidth: 250,
  maxHeight: 300,
  fontSize: 12,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
  beforeId: undefined,
  belowLabels: false,
};

/**
 * Source and layer IDs for the basemap raster layer.
 */
const BASEMAP_SOURCE_ID = "basemap-raster-source";
const BASEMAP_LAYER_ID = "basemap-raster-layer";

/**
 * A basemap switcher control for MapLibre GL maps.
 *
 * Allows users to interactively switch between different basemap tile sources.
 * Supports loading basemaps from xyzservices or custom basemap arrays.
 *
 * @example
 * ```typescript
 * const basemapControl = new BasemapControl({
 *   defaultBasemap: 'OpenStreetMap.Mapnik',
 *   showSearch: true,
 *   filterGroups: ['OpenStreetMap', 'CartoDB', 'Stadia'],
 * });
 * map.addControl(basemapControl, 'top-right');
 * ```
 */
export class BasemapControl implements IControl {
  private _container?: HTMLElement;
  private _options: typeof DEFAULT_OPTIONS;
  private _state: BasemapControlState;
  private _basemaps: BasemapItem[] = [];
  private _eventHandlers: Map<BasemapEvent, Set<BasemapEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new BasemapControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: BasemapControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      selectedBasemap: this._options.defaultBasemap || null,
      searchText: "",
      loading: false,
      error: null,
      belowLabels: this._options.belowLabels,
    };

    // Use provided basemaps if any
    if (this._options.basemaps.length > 0) {
      this._basemaps = [...this._options.basemaps];
    }
  }

  /**
   * Called when the control is added to the map.
   *
   * @param map - The MapLibre GL map instance.
   * @returns The control's container element.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();

    // Fetch providers if no basemaps provided
    if (this._basemaps.length === 0 && this._options.providersUrl) {
      this._fetchProviders();
    } else {
      this._render();
      // Apply initial basemap if specified
      if (this._state.selectedBasemap) {
        const basemap = this._basemaps.find(
          (b) => b.id === this._state.selectedBasemap,
        );
        if (basemap) {
          this._applyBasemap(basemap);
        }
      }
    }

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);
    this._checkZoomVisibility();

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }

    // Remove basemap layer and source
    this._removeBasemapLayer();

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Shows the control.
   */
  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit("show");
    }
  }

  /**
   * Hides the control.
   */
  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit("hide");
    }
  }

  /**
   * Expands the control (if collapsible).
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit("expand");
    }
  }

  /**
   * Collapses the control (if collapsible).
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit("collapse");
    }
  }

  /**
   * Toggles the collapsed state.
   */
  toggle(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Sets the active basemap by ID.
   *
   * @param basemapId - The ID of the basemap to activate.
   */
  setBasemap(basemapId: string): void {
    const basemap = this._basemaps.find((b) => b.id === basemapId);
    if (basemap) {
      this._state.selectedBasemap = basemapId;
      this._applyBasemap(basemap);
      this._render();
      this._emit("basemapchange", basemap);
      this._emit("update");
    }
  }

  /**
   * Gets the list of available basemaps.
   *
   * @returns Array of basemap items.
   */
  getBasemaps(): BasemapItem[] {
    return [...this._basemaps];
  }

  /**
   * Adds a custom basemap.
   *
   * @param basemap - The basemap item to add.
   */
  addBasemap(basemap: BasemapItem): void {
    this._basemaps.push(basemap);
    this._render();
  }

  /**
   * Removes a basemap by ID.
   *
   * @param basemapId - The ID of the basemap to remove.
   */
  removeBasemap(basemapId: string): void {
    this._basemaps = this._basemaps.filter((b) => b.id !== basemapId);
    this._render();
  }

  /**
   * Sets an API key for a basemap.
   *
   * @param basemapId - The ID of the basemap.
   * @param apiKey - The API key to set.
   */
  setApiKey(basemapId: string, apiKey: string): void {
    const basemap = this._basemaps.find((b) => b.id === basemapId);
    if (basemap) {
      basemap.apiKey = apiKey;
      basemap.requiresApiKey = false;
    }
  }

  /**
   * Updates control options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<BasemapControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.basemaps) {
      this._basemaps = [...options.basemaps];
    }
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  /**
   * Gets the current state.
   *
   * @returns The current control state.
   */
  getState(): BasemapControlState {
    return { ...this._state };
  }

  /**
   * Gets the currently selected basemap.
   *
   * @returns The selected basemap item, or null if none selected.
   */
  getSelectedBasemap(): BasemapItem | null {
    if (!this._state.selectedBasemap) return null;
    return (
      this._basemaps.find((b) => b.id === this._state.selectedBasemap) || null
    );
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: BasemapEvent, handler: BasemapEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event handler.
   *
   * @param event - The event type.
   * @param handler - The callback function to remove.
   */
  off(event: BasemapEvent, handler: BasemapEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emits an event to all registered handlers.
   */
  private _emit(
    event: ComponentEvent | "basemapchange",
    basemap?: BasemapItem,
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState(), basemap };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Fetches providers from the xyzservices URL.
   */
  private async _fetchProviders(): Promise<void> {
    this._state.loading = true;
    this._state.error = null;
    this._render();

    try {
      const response = await fetch(this._options.providersUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();

      let basemaps = parseProviders(data, {
        filterGroups: this._options.filterGroups,
        excludeGroups: this._options.excludeGroups,
        excludeBroken: this._options.excludeBroken,
      });

      // Filter out basemaps that require an API key but don't have one provided
      basemaps = basemaps.filter(
        (b) => !b.requiresApiKey || (b.requiresApiKey && b.apiKey),
      );

      // Add Google basemaps if not excluded
      const shouldIncludeGoogle =
        !this._options.excludeGroups?.includes("Google") &&
        (!this._options.filterGroups?.length ||
          this._options.filterGroups.includes("Google"));

      if (shouldIncludeGoogle) {
        basemaps = [...basemaps, ...GOOGLE_BASEMAPS];
      }

      this._basemaps = basemaps;

      this._state.loading = false;
      this._state.error = null;

      // Apply initial basemap if specified
      if (this._state.selectedBasemap) {
        const basemap = this._basemaps.find(
          (b) => b.id === this._state.selectedBasemap,
        );
        if (basemap) {
          this._applyBasemap(basemap);
        }
      }
    } catch (error) {
      this._state.loading = false;
      this._state.error =
        error instanceof Error ? error.message : "Failed to load providers";
      console.error("BasemapControl: Failed to fetch providers", error);
    }

    this._render();
  }

  /**
   * Applies a basemap to the map.
   */
  private _applyBasemap(basemap: BasemapItem): void {
    if (!this._map) return;

    // Check if basemap requires API key
    if (basemap.requiresApiKey && !basemap.apiKey) {
      console.warn(
        `BasemapControl: Basemap "${basemap.name}" requires an API key`,
      );
      return;
    }

    if (basemap.style) {
      // Vector style - use setStyle
      this._applyStyleBasemap(basemap);
    } else if (basemap.url) {
      // XYZ tiles - add as raster source/layer
      this._applyXYZBasemap(basemap);
    }
  }

  /**
   * Applies an XYZ tile basemap.
   */
  private _applyXYZBasemap(basemap: BasemapItem): void {
    if (!this._map) return;

    // Remove existing basemap layer
    this._removeBasemapLayer();

    // Build the tile URL
    const tileUrl = buildTileUrl(basemap);

    // Add raster source
    this._map.addSource(BASEMAP_SOURCE_ID, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
      attribution: basemap.attribution,
      maxzoom: basemap.maxZoom || 19,
      minzoom: basemap.minZoom || 0,
    });

    // Find the layer to insert before
    let beforeLayerId: string | undefined;
    if (this._state.belowLabels) {
      // Find the first symbol layer to insert basemap below labels
      const layers = this._map.getStyle()?.layers;
      if (layers) {
        for (const layer of layers) {
          if (layer.type === "symbol") {
            beforeLayerId = layer.id;
            break;
          }
        }
      }
    }

    // Add raster layer
    this._map.addLayer(
      {
        id: BASEMAP_LAYER_ID,
        type: "raster",
        source: BASEMAP_SOURCE_ID,
      },
      beforeLayerId,
    );
  }

  /**
   * Applies a vector style basemap.
   */
  private _applyStyleBasemap(basemap: BasemapItem): void {
    if (!this._map || !basemap.style) return;

    // Remove existing basemap layer first
    this._removeBasemapLayer();

    // For style-based basemaps, we need to be careful about preserving user layers
    // This is a simplified approach - for full layer preservation, more complex logic is needed
    this._map.setStyle(basemap.style);
  }

  /**
   * Removes the basemap layer and source.
   */
  private _removeBasemapLayer(): void {
    if (!this._map) return;

    if (this._map.getLayer(BASEMAP_LAYER_ID)) {
      this._map.removeLayer(BASEMAP_LAYER_ID);
    }
    if (this._map.getSource(BASEMAP_SOURCE_ID)) {
      this._map.removeSource(BASEMAP_SOURCE_ID);
    }
  }

  /**
   * Checks if the current zoom level is within the visibility range.
   */
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

  /**
   * Updates the display state based on visibility and zoom level.
   */
  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? "block" : "none";
  }

  /**
   * Creates the main container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-basemap${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = "none";
    }

    return container;
  }

  /**
   * Renders the control content.
   */
  private _render(): void {
    if (!this._container) return;

    const {
      backgroundColor,
      opacity,
      fontSize,
      fontColor,
      borderRadius,
      padding,
      maxWidth,
      maxHeight,
      collapsible,
      displayMode,
      showSearch,
    } = this._options;

    // Save scroll position before clearing content
    const contentEl = this._container.querySelector(
      ".maplibre-gl-basemap-content",
    );
    const scrollTop = contentEl ? contentEl.scrollTop : 0;

    // Clear existing content
    this._container.innerHTML = "";

    const shouldShow = this._state.visible && this._zoomVisible;

    // When collapsed and collapsible, show only icon button
    if (collapsible && this._state.collapsed) {
      Object.assign(this._container.style, {
        backgroundColor,
        opacity: opacity.toString(),
        borderRadius: `${borderRadius}px`,
        boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
        display: shouldShow ? "block" : "none",
        padding: "0",
        maxWidth: "none",
      });

      const iconButton = this._createIconButton();
      this._container.appendChild(iconButton);
      return;
    }

    // Apply container styles for expanded state
    Object.assign(this._container.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      maxWidth: `${maxWidth}px`,
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      display: shouldShow ? "block" : "none",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: "relative",
      padding: "0",
    });

    // Header with close button
    if (collapsible) {
      const header = this._createHeader();
      this._container.appendChild(header);
    }

    // Content
    const content = document.createElement("div");
    content.className = "maplibre-gl-basemap-content";
    Object.assign(content.style, {
      padding: `0 ${padding}px ${padding}px ${padding}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
    });

    // Loading state
    if (this._state.loading) {
      const loading = document.createElement("div");
      loading.className = "maplibre-gl-basemap-loading";
      loading.textContent = "Loading basemaps...";
      Object.assign(loading.style, {
        padding: "20px",
        textAlign: "center",
        color: "#666",
      });
      content.appendChild(loading);
    }
    // Error state
    else if (this._state.error) {
      const error = document.createElement("div");
      error.className = "maplibre-gl-basemap-error";
      error.textContent = this._state.error;
      Object.assign(error.style, {
        padding: "10px",
        color: "#d32f2f",
        fontSize: "0.9em",
      });
      content.appendChild(error);
    }
    // Normal content
    else {
      // Search input
      if (showSearch && this._basemaps.length > 5) {
        const searchInput = this._createSearchInput();
        content.appendChild(searchInput);
      }

      // Below labels checkbox
      const checkboxContainer = this._createBelowLabelsCheckbox();
      content.appendChild(checkboxContainer);

      // Basemap list - always use list mode when panel is expanded
      // (dropdown mode only affects collapsed icon behavior)
      const filteredBasemaps = filterBasemaps(
        this._basemaps,
        this._state.searchText,
      );

      if (displayMode === "gallery") {
        const gallery = this._renderGallery(filteredBasemaps);
        content.appendChild(gallery);
      } else {
        // Both 'dropdown' and 'list' modes show a scrollable list when expanded
        const list = this._renderList(filteredBasemaps);
        content.appendChild(list);
      }
    }

    this._container.appendChild(content);

    // Restore scroll position
    if (scrollTop > 0) {
      content.scrollTop = scrollTop;
    }
  }

  /**
   * Creates the icon button for collapsed state.
   */
  private _createIconButton(): HTMLElement {
    const button = document.createElement("button");
    button.className = "maplibre-gl-basemap-icon-button";
    button.title = "Basemaps";

    // Map icon SVG (folded map with pin)
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
        <line x1="8" y1="2" x2="8" y2="18"></line>
        <line x1="16" y1="6" x2="16" y2="22"></line>
      </svg>
    `;

    Object.assign(button.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "29px",
      height: "29px",
      padding: "0",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#333",
    });

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.expand();
    });

    button.addEventListener("mouseenter", () => {
      button.style.color = "#0078d7";
    });

    button.addEventListener("mouseleave", () => {
      button.style.color = "#333";
    });

    return button;
  }

  /**
   * Creates the header element.
   */
  private _createHeader(): HTMLElement {
    const { padding } = this._options;

    const header = document.createElement("div");
    header.className = "maplibre-gl-basemap-header";
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${padding}px`,
      borderBottom: "1px solid rgba(0,0,0,0.1)",
    });

    const title = document.createElement("span");
    title.className = "maplibre-gl-basemap-title";
    title.textContent = "Basemaps";
    title.style.fontWeight = "600";
    header.appendChild(title);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-basemap-close";
    closeBtn.title = "Close";
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    Object.assign(closeBtn.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      padding: "0",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#666",
      borderRadius: "4px",
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapse();
    });

    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.background = "rgba(0,0,0,0.1)";
      closeBtn.style.color = "#333";
    });

    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.background = "transparent";
      closeBtn.style.color = "#666";
    });

    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Creates the search input element.
   */
  private _createSearchInput(): HTMLElement {
    const container = document.createElement("div");
    container.style.marginBottom = "8px";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search basemaps...";
    input.className = "maplibre-gl-basemap-search";
    input.value = this._state.searchText;
    Object.assign(input.style, {
      width: "100%",
      padding: "6px 10px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "inherit",
      boxSizing: "border-box",
    });

    input.addEventListener("input", (e) => {
      this._state.searchText = (e.target as HTMLInputElement).value;
      this._render();
    });

    input.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    container.appendChild(input);
    return container;
  }

  /**
   * Creates the below labels checkbox element.
   */
  private _createBelowLabelsCheckbox(): HTMLElement {
    const container = document.createElement("div");
    container.className = "maplibre-gl-basemap-checkbox";
    Object.assign(container.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: "8px",
      padding: "4px 0",
      borderBottom: "1px solid #eee",
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "basemap-below-labels";
    checkbox.checked = this._state.belowLabels;
    Object.assign(checkbox.style, {
      marginRight: "8px",
      cursor: "pointer",
    });

    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      this._state.belowLabels = (e.target as HTMLInputElement).checked;
      // Re-apply current basemap with new layer ordering
      if (this._state.selectedBasemap) {
        const basemap = this._basemaps.find(
          (b) => b.id === this._state.selectedBasemap,
        );
        if (basemap) {
          this._applyBasemap(basemap);
        }
      }
    });

    const label = document.createElement("label");
    label.htmlFor = "basemap-below-labels";
    label.textContent = "Below labels";
    Object.assign(label.style, {
      cursor: "pointer",
      fontSize: "0.9em",
      color: "#666",
    });

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
  }

  /**
   * Renders the list mode.
   */
  private _renderList(basemaps: BasemapItem[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "maplibre-gl-basemap-list";

    // Group basemaps
    const groups = groupBasemaps(basemaps);

    groups.forEach((items, groupName) => {
      // Group header
      const groupHeader = document.createElement("div");
      groupHeader.className = "maplibre-gl-basemap-group";
      groupHeader.textContent = groupName;
      Object.assign(groupHeader.style, {
        fontWeight: "600",
        padding: "8px 0 4px",
        color: "#666",
        fontSize: "0.9em",
      });
      container.appendChild(groupHeader);

      // Group items
      items.forEach((basemap) => {
        const item = this._createBasemapItem(basemap, true);
        container.appendChild(item);
      });
    });

    return container;
  }

  /**
   * Renders the gallery mode.
   */
  private _renderGallery(basemaps: BasemapItem[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "maplibre-gl-basemap-gallery";
    Object.assign(container.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
      gap: "8px",
      maxHeight: `${this._options.maxHeight}px`,
      overflowY: "auto",
    });

    basemaps.forEach((basemap) => {
      const item = document.createElement("div");
      item.className = `maplibre-gl-basemap-gallery-item${
        basemap.id === this._state.selectedBasemap
          ? " maplibre-gl-basemap-gallery-item--selected"
          : ""
      }`;
      Object.assign(item.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        padding: "4px",
        borderRadius: "4px",
        transition: "background-color 0.15s",
        outline:
          basemap.id === this._state.selectedBasemap
            ? "2px solid #0078d7"
            : "none",
      });

      // Thumbnail
      const thumbnail = document.createElement("div");
      thumbnail.className = "maplibre-gl-basemap-thumbnail";
      Object.assign(thumbnail.style, {
        width: "60px",
        height: "60px",
        borderRadius: "4px",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        backgroundColor: "#f0f0f0",
        backgroundSize: "cover",
        backgroundPosition: "center",
      });

      // Generate thumbnail URL
      if (basemap.thumbnail || basemap.url) {
        let thumbUrl = basemap.thumbnail;
        if (!thumbUrl && basemap.url) {
          thumbUrl = buildTileUrl(basemap)
            .replace("{z}", "3")
            .replace("{x}", "4")
            .replace("{y}", "2");
        }
        if (thumbUrl) {
          thumbnail.style.backgroundImage = `url(${thumbUrl})`;
        }
      }

      // Name
      const name = document.createElement("div");
      name.className = "maplibre-gl-basemap-name";
      name.textContent = basemap.name;
      Object.assign(name.style, {
        marginTop: "4px",
        fontSize: "0.75em",
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "70px",
      });

      item.appendChild(thumbnail);
      item.appendChild(name);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.setBasemap(basemap.id);
      });

      item.addEventListener("mouseenter", () => {
        if (basemap.id !== this._state.selectedBasemap) {
          item.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
        }
      });

      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "";
      });

      container.appendChild(item);
    });

    return container;
  }

  /**
   * Creates a basemap item element.
   */
  private _createBasemapItem(
    basemap: BasemapItem,
    showRadio = false,
  ): HTMLElement {
    const item = document.createElement("div");
    item.className = `maplibre-gl-basemap-item${
      basemap.id === this._state.selectedBasemap
        ? " maplibre-gl-basemap-item--selected"
        : ""
    }`;
    Object.assign(item.style, {
      display: "flex",
      alignItems: "center",
      padding: "6px 12px",
      cursor: "pointer",
      borderRadius: "4px",
      transition: "background-color 0.15s",
      backgroundColor:
        basemap.id === this._state.selectedBasemap
          ? "rgba(0, 120, 215, 0.1)"
          : "",
    });

    if (showRadio) {
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "basemap";
      radio.checked = basemap.id === this._state.selectedBasemap;
      radio.className = "maplibre-gl-basemap-item-radio";
      radio.style.marginRight = "8px";
      item.appendChild(radio);
    }

    const label = document.createElement("span");
    label.textContent = basemap.name;
    label.style.flex = "1";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.style.whiteSpace = "nowrap";
    item.appendChild(label);

    // API key badge
    if (basemap.requiresApiKey && !basemap.apiKey) {
      const badge = document.createElement("span");
      badge.className = "maplibre-gl-basemap-apikey-badge";
      badge.textContent = "API";
      Object.assign(badge.style, {
        fontSize: "0.7em",
        background: "#ff9800",
        color: "white",
        padding: "2px 6px",
        borderRadius: "3px",
        marginLeft: "4px",
        flexShrink: "0",
      });
      item.appendChild(badge);
    }

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!basemap.requiresApiKey || basemap.apiKey) {
        this.setBasemap(basemap.id);
      }
    });

    item.addEventListener("mouseenter", () => {
      if (basemap.id !== this._state.selectedBasemap) {
        item.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
      }
    });

    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor =
        basemap.id === this._state.selectedBasemap
          ? "rgba(0, 120, 215, 0.1)"
          : "";
    });

    return item;
  }
}
