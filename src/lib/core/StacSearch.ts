import "../styles/common.css";
import "../styles/stac-search.css";
import { type IControl, type Map as MapLibreMap } from "maplibre-gl";
import type {
  StacSearchControlOptions,
  StacSearchControlState,
  StacSearchEvent,
  StacSearchEventHandler,
  StacCatalog,
  StacCollection,
  StacSearchItem,
  ControlPosition,
} from "./types";

/**
 * Default STAC catalogs.
 */
const DEFAULT_CATALOGS: StacCatalog[] = [
  {
    name: "Element84 Earth Search",
    url: "https://earth-search.aws.element84.com/v1",
  },
  {
    name: "Microsoft Planetary Computer",
    url: "https://planetarycomputer.microsoft.com/api/stac/v1",
  },
];

/**
 * Available colormap names for single band visualization.
 */
const COLORMAP_NAMES: string[] = [
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
 * Default options for the StacSearchControl.
 */
const DEFAULT_OPTIONS: Required<StacSearchControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  panelWidth: 360,
  maxHeight: 500,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  fontSize: 13,
  fontColor: "#1a1a1a",
  catalogs: DEFAULT_CATALOGS,
  maxItems: 20,
  defaultRescaleMin: 0,
  defaultRescaleMax: 10000,
  defaultColormap: "viridis",
  defaultRgbMode: true,
  showFootprints: true,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * STAC search icon SVG for the control button.
 */
const STAC_SEARCH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/>
  <path d="m21 21-4.3-4.3"/>
  <path d="M11 8v6"/>
  <path d="M8 11h6"/>
</svg>`;

/**
 * A control for searching and visualizing STAC items from STAC API catalogs.
 *
 * @example
 * ```typescript
 * const stacSearch = new StacSearchControl({
 *   catalogs: [
 *     { name: "Earth Search", url: "https://earth-search.aws.element84.com/v1" },
 *   ],
 * });
 * map.addControl(stacSearch, 'top-right');
 * ```
 */
export class StacSearchControl implements IControl {
  private _container?: HTMLElement;
  // @ts-expect-error - Used for potential future reference/debugging
  private _button?: HTMLButtonElement;
  // @ts-expect-error - Used for potential future reference/debugging
  private _panel?: HTMLElement;
  private _options: Required<StacSearchControlOptions>;
  private _state: StacSearchControlState;
  private _eventHandlers: Map<StacSearchEvent, Set<StacSearchEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _footprintSourceId: string = "stac-search-footprints";
  private _footprintLayerId: string = "stac-search-footprints-layer";
  private _footprintOutlineLayerId: string = "stac-search-footprints-outline";
  private _footprintHighlightLayerId: string =
    "stac-search-footprints-highlight";
  private _footprintHighlightOutlineLayerId: string =
    "stac-search-footprints-highlight-outline";
  private _showCustomUrlInput: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _deckOverlay?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayers: Map<string, any> = new Map();
  private _layerCounter = 0;

  constructor(options?: StacSearchControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      catalogs: this._options.catalogs,
      selectedCatalog:
        this._options.catalogs.length > 0 ? this._options.catalogs[0] : null,
      collections: [],
      selectedCollection: null,
      startDate: null,
      endDate: null,
      maxItems: this._options.maxItems,
      queryFilter: "",
      items: [],
      selectedItem: null,
      rescaleMin: this._options.defaultRescaleMin,
      rescaleMax: this._options.defaultRescaleMax,
      isRgbMode: this._options.defaultRgbMode,
      colormap: this._options.defaultColormap,
      availableAssets: [],
      selectedBand: null,
      rgbBands: { r: null, g: null, b: null },
      hasLayer: false,
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

    return this._container;
  }

  onRemove(): void {
    this._removeFootprints();
    this._removeAllLayers();

    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
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

  getState(): StacSearchControlState {
    return { ...this._state };
  }

  update(options: Partial<StacSearchControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    if (options.catalogs) {
      this._state.catalogs = options.catalogs;
      if (options.catalogs.length > 0 && !this._state.selectedCatalog) {
        this._state.selectedCatalog = options.catalogs[0];
      }
    }
    this._render();
  }

  on(event: StacSearchEvent, handler: StacSearchEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: StacSearchEvent, handler: StacSearchEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Get the currently selected STAC item.
   */
  getSelectedItem(): StacSearchItem | null {
    return this._state.selectedItem;
  }

  /**
   * Get all search result items.
   */
  getItems(): StacSearchItem[] {
    return [...this._state.items];
  }

  private _emit(
    event: StacSearchEvent,
    extra?: {
      catalog?: StacCatalog;
      collection?: StacCollection;
      item?: StacSearchItem;
      error?: string;
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
    container.className = `maplibregl-ctrl maplibre-gl-stac-search ${this._options.className || ""}`;

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

    // Save scroll position before re-rendering
    const panel = this._container.querySelector(
      ".maplibre-gl-stac-search-panel",
    );
    const scrollTop = panel?.scrollTop ?? 0;

    this._container.innerHTML = "";

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();

      // Restore scroll position after re-rendering
      const newPanel = this._container.querySelector(
        ".maplibre-gl-stac-search-panel",
      );
      if (newPanel && scrollTop > 0) {
        newPanel.scrollTop = scrollTop;
      }
    }
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    const button = document.createElement("button");
    button.className = `maplibre-gl-stac-search-button${this._state.hasLayer ? " maplibre-gl-stac-search-button--active" : ""}`;
    button.innerHTML = STAC_SEARCH_ICON;
    button.title = "STAC Search";
    button.addEventListener("click", () => this.expand());

    this._container.appendChild(button);
    this._button = button;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement("div");
    panel.className = "maplibre-gl-stac-search-panel";
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
    header.className = "maplibre-gl-stac-search-header";

    const title = document.createElement("span");
    title.className = "maplibre-gl-stac-search-title";
    title.textContent = "STAC Search";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "maplibre-gl-stac-search-close";
    closeBtn.innerHTML = "×";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Catalog selector
    const catalogGroup = this._createFormGroup("Catalog", "catalog");
    const catalogSelect = document.createElement("select");
    catalogSelect.id = "stac-search-catalog";
    catalogSelect.className = "maplibre-gl-stac-search-select";
    catalogSelect.style.color = "#000";

    for (const catalog of this._state.catalogs) {
      const option = document.createElement("option");
      option.value = catalog.url;
      option.textContent = catalog.name;
      option.selected = this._state.selectedCatalog?.url === catalog.url;
      catalogSelect.appendChild(option);
    }

    // Add "Custom URL" option
    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "── Custom URL ──";
    customOption.selected =
      this._showCustomUrlInput ||
      this._state.selectedCatalog?.name === "__custom__";
    catalogSelect.appendChild(customOption);

    catalogSelect.addEventListener("change", () => {
      if (catalogSelect.value === "__custom__") {
        // Show custom URL input
        this._showCustomUrlInput = true;
        this._render();
        return;
      }
      this._showCustomUrlInput = false;
      const selected = this._state.catalogs.find(
        (c) => c.url === catalogSelect.value,
      );
      if (selected) {
        this._state.selectedCatalog = selected;
        this._state.collections = [];
        this._state.selectedCollection = null;
        this._state.items = [];
        this._state.selectedItem = null;
        this._emit("catalogselect", { catalog: selected });
        this._render();
      }
    });

    catalogGroup.appendChild(catalogSelect);

    // Custom URL input (show if custom is selected or if current catalog is custom)
    if (
      this._showCustomUrlInput ||
      this._state.selectedCatalog?.name === "__custom__"
    ) {
      const customUrlRow = document.createElement("div");
      customUrlRow.className = "maplibre-gl-stac-search-custom-url-row";

      const customUrlInput = document.createElement("input");
      customUrlInput.type = "text";
      customUrlInput.id = "stac-search-custom-url";
      customUrlInput.className = "maplibre-gl-stac-search-input";
      customUrlInput.style.color = "#000";
      customUrlInput.placeholder = "https://stac-api.example.com/v1";
      customUrlInput.value =
        this._state.selectedCatalog?.name === "__custom__"
          ? this._state.selectedCatalog.url
          : "";

      const addCustomBtn = document.createElement("button");
      addCustomBtn.className =
        "maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--secondary";
      addCustomBtn.textContent = "Use";
      addCustomBtn.addEventListener("click", () => {
        const url = customUrlInput.value.trim();
        if (url) {
          this._showCustomUrlInput = false;
          this._state.selectedCatalog = { name: "__custom__", url };
          this._state.collections = [];
          this._state.selectedCollection = null;
          this._state.items = [];
          this._state.selectedItem = null;
          this._emit("catalogselect", { catalog: this._state.selectedCatalog });
          this._render();
        }
      });

      customUrlRow.appendChild(customUrlInput);
      customUrlRow.appendChild(addCustomBtn);
      catalogGroup.appendChild(customUrlRow);
    }

    panel.appendChild(catalogGroup);

    // Collections button and selector
    const collectionsGroup = this._createFormGroup("Collection", "collection");

    const collectionsRow = document.createElement("div");
    collectionsRow.className = "maplibre-gl-stac-search-row";

    const fetchCollectionsBtn = document.createElement("button");
    fetchCollectionsBtn.className =
      "maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--secondary";
    fetchCollectionsBtn.textContent = "Collections";
    fetchCollectionsBtn.disabled =
      this._state.loading || !this._state.selectedCatalog;
    fetchCollectionsBtn.addEventListener("click", () =>
      this._fetchCollections(),
    );
    collectionsRow.appendChild(fetchCollectionsBtn);

    const collectionSelect = document.createElement("select");
    collectionSelect.id = "stac-search-collection";
    collectionSelect.className =
      "maplibre-gl-stac-search-select maplibre-gl-stac-search-select--flex";
    collectionSelect.style.color = "#000";
    collectionSelect.disabled = this._state.collections.length === 0;

    if (this._state.collections.length === 0) {
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "-- Click Collections --";
      collectionSelect.appendChild(defaultOption);
    } else {
      for (const collection of this._state.collections) {
        const option = document.createElement("option");
        option.value = collection.id;
        option.textContent = collection.title || collection.id;
        option.selected = this._state.selectedCollection?.id === collection.id;
        collectionSelect.appendChild(option);
      }
    }

    collectionSelect.addEventListener("change", () => {
      const selected = this._state.collections.find(
        (c) => c.id === collectionSelect.value,
      );
      if (selected) {
        this._state.selectedCollection = selected;
        this._state.items = [];
        this._state.selectedItem = null;
        this._emit("collectionselect", { collection: selected });
        this._render();
      }
    });

    collectionsRow.appendChild(collectionSelect);
    collectionsGroup.appendChild(collectionsRow);
    panel.appendChild(collectionsGroup);

    // Date range
    const dateGroup = this._createFormGroup("Date Range", "date");
    const dateRow = document.createElement("div");
    dateRow.className = "maplibre-gl-stac-search-date-row";

    const startInput = document.createElement("input");
    startInput.type = "date";
    startInput.id = "stac-search-start-date";
    startInput.className =
      "maplibre-gl-stac-search-input maplibre-gl-stac-search-input--half";
    startInput.style.color = "#000";
    startInput.value = this._state.startDate || "";
    startInput.addEventListener("change", () => {
      this._state.startDate = startInput.value || null;
    });

    const endInput = document.createElement("input");
    endInput.type = "date";
    endInput.id = "stac-search-end-date";
    endInput.className =
      "maplibre-gl-stac-search-input maplibre-gl-stac-search-input--half";
    endInput.style.color = "#000";
    endInput.value = this._state.endDate || "";
    endInput.addEventListener("change", () => {
      this._state.endDate = endInput.value || null;
    });

    dateRow.appendChild(startInput);
    dateRow.appendChild(endInput);
    dateGroup.appendChild(dateRow);
    panel.appendChild(dateGroup);

    // Max items
    const maxItemsGroup = this._createFormGroup("Max Items", "maxitems");
    const maxItemsInput = document.createElement("input");
    maxItemsInput.type = "number";
    maxItemsInput.id = "stac-search-maxitems";
    maxItemsInput.className = "maplibre-gl-stac-search-input";
    maxItemsInput.style.color = "#000";
    maxItemsInput.min = "1";
    maxItemsInput.max = "100";
    maxItemsInput.value = String(this._state.maxItems);
    maxItemsInput.addEventListener("change", () => {
      this._state.maxItems = Math.max(
        1,
        Math.min(100, Number(maxItemsInput.value) || 20),
      );
    });
    maxItemsGroup.appendChild(maxItemsInput);
    panel.appendChild(maxItemsGroup);

    // Query filter
    const queryGroup = this._createFormGroup(
      "Query Filter (optional)",
      "query",
    );
    const queryInput = document.createElement("input");
    queryInput.type = "text";
    queryInput.id = "stac-search-query";
    queryInput.className = "maplibre-gl-stac-search-input";
    queryInput.style.color = "#000";
    queryInput.placeholder = '{"eo:cloud_cover": {"lt": 10}}';
    queryInput.value = this._state.queryFilter;
    queryInput.addEventListener("change", () => {
      this._state.queryFilter = queryInput.value.trim();
    });
    queryGroup.appendChild(queryInput);

    const queryHint = document.createElement("div");
    queryHint.className = "maplibre-gl-stac-search-hint";
    queryHint.textContent = "JSON filter, e.g., cloud cover < 10%";
    queryGroup.appendChild(queryHint);

    panel.appendChild(queryGroup);

    // Search button
    const searchGroup = document.createElement("div");
    searchGroup.className = "maplibre-gl-stac-search-form-group";

    const searchBtn = document.createElement("button");
    searchBtn.className =
      "maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--primary";
    searchBtn.textContent = "Search Items";
    searchBtn.disabled = this._state.loading || !this._state.selectedCollection;
    searchBtn.addEventListener("click", () => this._searchItems());
    searchGroup.appendChild(searchBtn);

    const searchHintRow = document.createElement("div");
    searchHintRow.className = "maplibre-gl-stac-search-hint-row";

    const searchHint = document.createElement("div");
    searchHint.className = "maplibre-gl-stac-search-hint";
    searchHint.textContent = "Uses current map bounds";
    searchHintRow.appendChild(searchHint);

    // Add clear footprints button if there are items
    if (this._state.items.length > 0) {
      const clearFootprintsBtn = document.createElement("button");
      clearFootprintsBtn.className =
        "maplibre-gl-stac-search-btn-clear-footprints";
      clearFootprintsBtn.textContent = "Clear Footprints";
      clearFootprintsBtn.title = "Remove footprints from map";
      clearFootprintsBtn.addEventListener("click", () => {
        this._removeFootprints();
        this._state.items = [];
        this._state.selectedItem = null;
        this._render();
      });
      searchHintRow.appendChild(clearFootprintsBtn);
    }

    searchGroup.appendChild(searchHintRow);

    panel.appendChild(searchGroup);

    // Items selector (only show if items exist)
    if (this._state.items.length > 0) {
      const itemsGroup = this._createFormGroup("Select Item", "item");
      const itemSelect = document.createElement("select");
      itemSelect.id = "stac-search-item";
      itemSelect.className = "maplibre-gl-stac-search-select";
      itemSelect.style.color = "#000";

      for (const item of this._state.items) {
        const option = document.createElement("option");
        option.value = item.id;
        const dateStr = item.datetime
          ? new Date(item.datetime).toLocaleDateString()
          : "";
        option.textContent = `${item.id}${dateStr ? ` (${dateStr})` : ""}`;
        option.selected = this._state.selectedItem?.id === item.id;
        itemSelect.appendChild(option);
      }

      itemSelect.addEventListener("change", () => {
        const selected = this._state.items.find(
          (i) => i.id === itemSelect.value,
        );
        if (selected) {
          this._state.selectedItem = selected;
          this._updateAvailableAssets(selected);
          this._updateFootprintHighlight();
          this._emit("itemselect", { item: selected });
          this._render();
        }
      });

      itemsGroup.appendChild(itemSelect);
      panel.appendChild(itemsGroup);

      // Visualization mode toggle (RGB vs Single Band)
      const modeGroup = this._createFormGroup("Visualization Mode", "mode");
      const modeRow = document.createElement("div");
      modeRow.className = "maplibre-gl-stac-search-mode-row";

      const singleBandBtn = document.createElement("button");
      singleBandBtn.className = `maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--toggle ${!this._state.isRgbMode ? "active" : ""}`;
      singleBandBtn.textContent = "Single Band";
      singleBandBtn.addEventListener("click", () => {
        this._state.isRgbMode = false;
        this._render();
      });

      const rgbBtn = document.createElement("button");
      rgbBtn.className = `maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--toggle ${this._state.isRgbMode ? "active" : ""}`;
      rgbBtn.textContent = "RGB Composite";
      rgbBtn.addEventListener("click", () => {
        this._state.isRgbMode = true;
        this._render();
      });

      modeRow.appendChild(singleBandBtn);
      modeRow.appendChild(rgbBtn);
      modeGroup.appendChild(modeRow);
      panel.appendChild(modeGroup);

      // Band selectors based on mode
      const assets = this._state.availableAssets;

      if (!this._state.isRgbMode) {
        // Single band mode - band selector
        const bandGroup = this._createFormGroup("Band", "band");
        const bandSelect = document.createElement("select");
        bandSelect.id = "stac-search-band";
        bandSelect.className = "maplibre-gl-stac-search-select";
        bandSelect.style.color = "#000";

        for (const asset of assets) {
          const option = document.createElement("option");
          option.value = asset;
          option.textContent = asset;
          option.selected = this._state.selectedBand === asset;
          bandSelect.appendChild(option);
        }

        bandSelect.addEventListener("change", () => {
          this._state.selectedBand = bandSelect.value;
        });

        bandGroup.appendChild(bandSelect);
        panel.appendChild(bandGroup);

        // Colormap selector
        const colormapGroup = this._createFormGroup("Colormap", "colormap");
        const colormapSelect = document.createElement("select");
        colormapSelect.id = "stac-search-colormap";
        colormapSelect.className = "maplibre-gl-stac-search-select";
        colormapSelect.style.color = "#000";

        const noneOption = document.createElement("option");
        noneOption.value = "none";
        noneOption.textContent = "None (Grayscale)";
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
          this._state.colormap = colormapSelect.value;
        });

        colormapGroup.appendChild(colormapSelect);
        panel.appendChild(colormapGroup);
      } else {
        // RGB mode - three band selectors
        const rgbGroup = this._createFormGroup("RGB Bands", "rgb");
        const rgbRow = document.createElement("div");
        rgbRow.className = "maplibre-gl-stac-search-rgb-row";

        const channels: Array<{ key: "r" | "g" | "b"; label: string }> = [
          { key: "r", label: "R" },
          { key: "g", label: "G" },
          { key: "b", label: "B" },
        ];

        for (const channel of channels) {
          const wrapper = document.createElement("div");
          wrapper.className = "maplibre-gl-stac-search-rgb-channel";

          const label = document.createElement("label");
          label.textContent = channel.label;
          label.className = "maplibre-gl-stac-search-rgb-label";
          wrapper.appendChild(label);

          const select = document.createElement("select");
          select.className =
            "maplibre-gl-stac-search-select maplibre-gl-stac-search-select--small";
          select.style.color = "#000";

          for (const asset of assets) {
            const option = document.createElement("option");
            option.value = asset;
            option.textContent = asset;
            option.selected = this._state.rgbBands[channel.key] === asset;
            select.appendChild(option);
          }

          select.addEventListener("change", () => {
            this._state.rgbBands[channel.key] = select.value;
          });

          wrapper.appendChild(select);
          rgbRow.appendChild(wrapper);
        }

        rgbGroup.appendChild(rgbRow);
        panel.appendChild(rgbGroup);
      }

      // Rescale inputs
      const rescaleGroup = this._createFormGroup("Rescale Range", "rescale");
      const rescaleRow = document.createElement("div");
      rescaleRow.className = "maplibre-gl-stac-search-rescale-row";

      const minInput = document.createElement("input");
      minInput.type = "number";
      minInput.className =
        "maplibre-gl-stac-search-input maplibre-gl-stac-search-input--half";
      minInput.style.color = "#000";
      minInput.placeholder = "Min";
      minInput.value = String(this._state.rescaleMin);
      minInput.addEventListener("change", () => {
        this._state.rescaleMin = Number(minInput.value) || 0;
      });

      const maxInput = document.createElement("input");
      maxInput.type = "number";
      maxInput.className =
        "maplibre-gl-stac-search-input maplibre-gl-stac-search-input--half";
      maxInput.style.color = "#000";
      maxInput.placeholder = "Max";
      maxInput.value = String(this._state.rescaleMax);
      maxInput.addEventListener("change", () => {
        this._state.rescaleMax = Number(maxInput.value) || 10000;
      });

      rescaleRow.appendChild(minInput);
      rescaleRow.appendChild(maxInput);
      rescaleGroup.appendChild(rescaleRow);
      panel.appendChild(rescaleGroup);

      // Display button
      const displayGroup = document.createElement("div");
      displayGroup.className = "maplibre-gl-stac-search-form-group";

      const displayBtn = document.createElement("button");
      displayBtn.className =
        "maplibre-gl-stac-search-btn maplibre-gl-stac-search-btn--primary";
      displayBtn.textContent = "Display Item";
      displayBtn.disabled = this._state.loading || !this._state.selectedItem;
      displayBtn.addEventListener("click", () => this._displayItem());
      displayGroup.appendChild(displayBtn);

      panel.appendChild(displayGroup);
    }

    // Status/error area
    if (this._state.loading) {
      this._appendStatus(panel, "Loading...", "info");
    } else if (this._state.error) {
      this._appendStatus(panel, this._state.error, "error");
    } else if (this._state.status) {
      this._appendStatus(panel, this._state.status, "success");
    }

    // Layer list
    if (this._cogLayers.size > 0) {
      const listContainer = document.createElement("div");
      listContainer.className = "maplibre-gl-stac-search-list";

      const listHeaderRow = document.createElement("div");
      listHeaderRow.className = "maplibre-gl-stac-search-list-header-row";

      const listHeader = document.createElement("div");
      listHeader.className = "maplibre-gl-stac-search-list-header";
      listHeader.textContent = `Layers (${this._cogLayers.size})`;
      listHeaderRow.appendChild(listHeader);

      const clearAllBtn = document.createElement("button");
      clearAllBtn.className = "maplibre-gl-stac-search-btn-clear";
      clearAllBtn.textContent = "Clear All";
      clearAllBtn.title = "Remove all layers";
      clearAllBtn.addEventListener("click", () => {
        this._removeAllLayers();
        this._render();
      });
      listHeaderRow.appendChild(clearAllBtn);

      listContainer.appendChild(listHeaderRow);

      for (const [layerId] of this._cogLayers) {
        const item = document.createElement("div");
        item.className = "maplibre-gl-stac-search-list-item";

        const label = document.createElement("span");
        label.className = "maplibre-gl-stac-search-list-label";
        label.textContent = layerId;
        item.appendChild(label);

        const removeBtn = document.createElement("button");
        removeBtn.className = "maplibre-gl-stac-search-list-remove";
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
    group.className = "maplibre-gl-stac-search-form-group";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `stac-search-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(
    panel: HTMLElement,
    message: string,
    type: "info" | "error" | "success",
  ): void {
    const status = document.createElement("div");
    status.className = `maplibre-gl-stac-search-status maplibre-gl-stac-search-status--${type}`;
    status.textContent = message;
    panel.appendChild(status);
  }

  private async _fetchCollections(): Promise<void> {
    if (!this._state.selectedCatalog) {
      this._state.error = "Please select a catalog.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      const url = `${this._state.selectedCatalog.url}/collections`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const collections: StacCollection[] = (data.collections || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
        }),
      );

      // Sort collections alphabetically by title or id
      collections.sort((a, b) => {
        const aName = a.title || a.id;
        const bName = b.title || b.id;
        return aName.localeCompare(bName);
      });

      this._state.collections = collections;
      this._state.selectedCollection =
        collections.length > 0 ? collections[0] : null;
      this._state.loading = false;
      this._state.status = `Found ${collections.length} collection(s)`;
      this._emit("collectionsload", {});
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load collections: ${err instanceof Error ? err.message : String(err)}`;
      this._emit("error", { error: this._state.error });
    }

    this._render();
  }

  private async _searchItems(): Promise<void> {
    if (!this._state.selectedCatalog || !this._state.selectedCollection) {
      this._state.error = "Please select a catalog and collection.";
      this._render();
      return;
    }

    if (!this._map) {
      this._state.error = "Map not available.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      // Get current map bounds
      const bounds = this._map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      // Build search request
      const searchUrl = `${this._state.selectedCatalog.url}/search`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchBody: Record<string, any> = {
        collections: [this._state.selectedCollection.id],
        bbox,
        limit: this._state.maxItems,
      };

      // Add date range if specified
      if (this._state.startDate || this._state.endDate) {
        const start = this._state.startDate || "1900-01-01";
        const end =
          this._state.endDate || new Date().toISOString().split("T")[0];
        searchBody.datetime = `${start}T00:00:00Z/${end}T23:59:59Z`;
      }

      // Add query filter if specified (STAC API Query extension)
      if (this._state.queryFilter) {
        try {
          const queryObj = JSON.parse(this._state.queryFilter);
          searchBody.query = queryObj;
        } catch {
          // Invalid JSON, ignore the query filter
          console.warn("Invalid query filter JSON:", this._state.queryFilter);
        }
      }

      const response = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        throw new Error(
          `Search failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const items: StacSearchItem[] = (data.features || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => {
          // Find self link
          const selfLink = f.links?.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => l.rel === "self",
          )?.href;

          return {
            id: f.id,
            datetime: f.properties?.datetime,
            geometry: f.geometry,
            bbox: f.bbox,
            selfLink,
            properties: f.properties,
            assets: f.assets, // Include assets for visualization options
          };
        },
      );

      this._state.items = items;
      this._state.selectedItem = items.length > 0 ? items[0] : null;
      if (this._state.selectedItem) {
        this._updateAvailableAssets(this._state.selectedItem);
      }
      this._state.loading = false;
      this._state.status = `Found ${items.length} item(s)`;
      this._emit("search", {});

      // Add footprints to map
      if (this._options.showFootprints && items.length > 0) {
        this._addFootprints(data.features || []);
      }
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Search failed: ${err instanceof Error ? err.message : String(err)}`;
      this._emit("error", { error: this._state.error });
    }

    this._render();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _addFootprints(features: any[]): void {
    if (!this._map) return;

    // Remove existing footprints
    this._removeFootprints();

    // Create GeoJSON for footprints
    const geojson = {
      type: "FeatureCollection" as const,
      features: features.map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry,
        properties: {
          id: f.id,
          datetime: f.properties?.datetime,
        },
      })),
    };

    // Add source
    this._map.addSource(this._footprintSourceId, {
      type: "geojson",
      data: geojson,
    });

    // Add fill layer
    this._map.addLayer({
      id: this._footprintLayerId,
      type: "fill",
      source: this._footprintSourceId,
      paint: {
        "fill-color": "#0078d7",
        "fill-opacity": 0.1,
      },
    });

    // Add outline layer
    this._map.addLayer({
      id: this._footprintOutlineLayerId,
      type: "line",
      source: this._footprintSourceId,
      paint: {
        "line-color": "#0078d7",
        "line-width": 2,
      },
    });

    // Add highlight fill layer for selected item
    this._map.addLayer({
      id: this._footprintHighlightLayerId,
      type: "fill",
      source: this._footprintSourceId,
      paint: {
        "fill-color": "#ff6b00",
        "fill-opacity": 0.3,
      },
      filter: ["==", ["get", "id"], ""],
    });

    // Add highlight outline layer for selected item
    this._map.addLayer({
      id: this._footprintHighlightOutlineLayerId,
      type: "line",
      source: this._footprintSourceId,
      paint: {
        "line-color": "#ff6b00",
        "line-width": 3,
      },
      filter: ["==", ["get", "id"], ""],
    });

    // Update highlight if there's a selected item
    this._updateFootprintHighlight();

    // Add click handler for footprints
    this._map.on("click", this._footprintLayerId, (e) => {
      if (e.features && e.features.length > 0) {
        const clickedId = e.features[0].properties?.id;
        const item = this._state.items.find((i) => i.id === clickedId);
        if (item) {
          this._state.selectedItem = item;
          this._updateFootprintHighlight();
          this._emit("itemselect", { item });
          this._render();
        }
      }
    });

    // Change cursor on hover
    this._map.on("mouseenter", this._footprintLayerId, () => {
      if (this._map) this._map.getCanvas().style.cursor = "pointer";
    });
    this._map.on("mouseleave", this._footprintLayerId, () => {
      if (this._map) this._map.getCanvas().style.cursor = "";
    });
  }

  private _removeFootprints(): void {
    if (!this._map) return;

    if (this._map.getLayer(this._footprintHighlightOutlineLayerId)) {
      this._map.removeLayer(this._footprintHighlightOutlineLayerId);
    }
    if (this._map.getLayer(this._footprintHighlightLayerId)) {
      this._map.removeLayer(this._footprintHighlightLayerId);
    }
    if (this._map.getLayer(this._footprintOutlineLayerId)) {
      this._map.removeLayer(this._footprintOutlineLayerId);
    }
    if (this._map.getLayer(this._footprintLayerId)) {
      this._map.removeLayer(this._footprintLayerId);
    }
    if (this._map.getSource(this._footprintSourceId)) {
      this._map.removeSource(this._footprintSourceId);
    }
  }

  /**
   * Update available assets based on the selected item.
   */
  private _updateAvailableAssets(item: StacSearchItem): void {
    const assets: string[] = [];

    // Common band/asset names to look for
    const commonBandNames = new Set([
      "red",
      "green",
      "blue",
      "nir",
      "nir08",
      "nir09",
      "swir",
      "swir16",
      "swir22",
      "coastal",
      "data",
      "visual",
      "image",
      "thumbnail",
      "overview",
      // Sentinel-2
      "B01",
      "B02",
      "B03",
      "B04",
      "B05",
      "B06",
      "B07",
      "B08",
      "B8A",
      "B09",
      "B10",
      "B11",
      "B12",
      "AOT",
      "WVP",
      "SCL",
      // Landsat
      "SR_B1",
      "SR_B2",
      "SR_B3",
      "SR_B4",
      "SR_B5",
      "SR_B6",
      "SR_B7",
      "ST_B10",
      "lwir",
      "lwir11",
      // NAIP
      "rgbir",
      // Generic
      "raster",
      "dem",
      "dsm",
      "dtm",
      "elevation",
    ]);

    if (item.assets) {
      for (const [key, asset] of Object.entries(item.assets)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetObj = asset as any;
        const href = assetObj.href || "";
        const type = assetObj.type || "";

        // Include asset if it's a raster type or has a known band name
        const isRasterType =
          type.includes("geotiff") ||
          type.includes("image/tiff") ||
          type.includes("image/") ||
          type.includes("application/x-hdf") ||
          href.endsWith(".tif") ||
          href.endsWith(".tiff") ||
          href.endsWith(".jp2");

        const isKnownBand =
          commonBandNames.has(key) || commonBandNames.has(key.toLowerCase());

        // Exclude metadata/auxiliary files
        const isMetadata =
          key.includes("metadata") ||
          key.includes("xml") ||
          key.includes("json") ||
          type.includes("application/json") ||
          type.includes("application/xml") ||
          type.includes("text/");

        if ((isRasterType || isKnownBand) && !isMetadata) {
          assets.push(key);
        }
      }
    }

    // Sort assets for consistent display
    assets.sort();
    this._state.availableAssets = assets;

    // Set default band selections
    if (assets.length > 0) {
      // For single band, default to first asset
      if (
        !this._state.selectedBand ||
        !assets.includes(this._state.selectedBand)
      ) {
        this._state.selectedBand = assets[0];
      }

      // For RGB, try to find common RGB band combinations
      const rgbDefaults = this._findDefaultRgbBands(assets);
      if (!this._state.rgbBands.r || !assets.includes(this._state.rgbBands.r)) {
        this._state.rgbBands.r = rgbDefaults.r;
      }
      if (!this._state.rgbBands.g || !assets.includes(this._state.rgbBands.g)) {
        this._state.rgbBands.g = rgbDefaults.g;
      }
      if (!this._state.rgbBands.b || !assets.includes(this._state.rgbBands.b)) {
        this._state.rgbBands.b = rgbDefaults.b;
      }
    }
  }

  /**
   * Find default RGB band assignments based on available assets.
   */
  private _findDefaultRgbBands(assets: string[]): {
    r: string;
    g: string;
    b: string;
  } {
    // Common RGB band patterns
    const patterns = [
      // Sentinel-2
      { r: "B04", g: "B03", b: "B02" },
      { r: "red", g: "green", b: "blue" },
      // Landsat
      { r: "SR_B4", g: "SR_B3", b: "SR_B2" },
      { r: "B4", g: "B3", b: "B2" },
      // Generic
      { r: "visual", g: "visual", b: "visual" },
    ];

    for (const pattern of patterns) {
      if (
        assets.includes(pattern.r) &&
        assets.includes(pattern.g) &&
        assets.includes(pattern.b)
      ) {
        return pattern;
      }
    }

    // Fallback: use first three assets or repeat first asset
    return {
      r: assets[0] || "",
      g: assets[1] || assets[0] || "",
      b: assets[2] || assets[0] || "",
    };
  }

  /**
   * Update the footprint highlight to show the selected item.
   */
  private _updateFootprintHighlight(): void {
    if (!this._map) return;

    const selectedId = this._state.selectedItem?.id || "";
    const filter: ["==", ["get", string], string] = [
      "==",
      ["get", "id"],
      selectedId,
    ];

    if (this._map.getLayer(this._footprintHighlightLayerId)) {
      this._map.setFilter(this._footprintHighlightLayerId, filter);
    }
    if (this._map.getLayer(this._footprintHighlightOutlineLayerId)) {
      this._map.setFilter(this._footprintHighlightOutlineLayerId, filter);
    }
  }

  /**
   * Check if a catalog URL is for Microsoft Planetary Computer.
   */
  private _isPlanetaryComputer(): boolean {
    return (
      this._state.selectedCatalog?.url?.includes(
        "planetarycomputer.microsoft.com",
      ) ?? false
    );
  }

  /**
   * Get default assets for a collection (fallback when no user selection).
   */
  private _getDefaultAssets(collection: string): string {
    if (collection.includes("sentinel-2")) {
      return "B04,B03,B02";
    } else if (collection.includes("landsat")) {
      return "red,green,blue";
    } else if (collection.includes("naip")) {
      return "image";
    } else if (collection.includes("aster")) {
      return "VNIR";
    }
    return "data";
  }

  /**
   * Get default rescale for a collection (fallback when no user selection).
   */
  private _getDefaultRescale(collection: string): string {
    if (collection.includes("sentinel-2")) {
      return "0,3000&rescale=0,3000&rescale=0,3000";
    } else if (collection.includes("landsat")) {
      return "0,20000&rescale=0,20000&rescale=0,20000";
    } else if (
      collection.includes("dem") ||
      collection.includes("elevation") ||
      collection.includes("cop-dem")
    ) {
      return "0,4000";
    } else if (collection.includes("naip") || collection.includes("aster")) {
      return "0,255&rescale=0,255&rescale=0,255";
    }
    return "0,10000";
  }

  private async _displayItem(): Promise<void> {
    if (!this._state.selectedItem) {
      this._state.error = "Please select an item.";
      this._render();
      return;
    }

    if (!this._map) {
      this._state.error = "Map not available.";
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      // Check if this is Planetary Computer - use TiTiler endpoint
      if (this._isPlanetaryComputer() && this._state.selectedCollection) {
        await this._displayPlanetaryComputerItem();
        return;
      }

      // Get the item URL for other catalogs
      let itemUrl = this._state.selectedItem.selfLink;

      if (
        !itemUrl &&
        this._state.selectedCatalog &&
        this._state.selectedCollection
      ) {
        // Construct URL from catalog/collection/item
        itemUrl = `${this._state.selectedCatalog.url}/collections/${this._state.selectedCollection.id}/items/${this._state.selectedItem.id}`;
      }

      if (!itemUrl) {
        throw new Error("Cannot determine item URL");
      }

      // Fetch the full item
      const response = await fetch(itemUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch item: ${response.status}`);
      }

      const stacItem = await response.json();

      // Find a suitable visual asset or the first COG asset
      let assetKey: string | null = null;
      let assetHref: string | null = null;

      // Priority order for assets
      const priorityKeys = ["visual", "true-color", "rgb", "thumbnail"];

      for (const key of priorityKeys) {
        if (stacItem.assets?.[key]) {
          const asset = stacItem.assets[key];
          if (
            asset.type?.includes("geotiff") ||
            asset.type?.includes("image/tiff") ||
            asset.href?.endsWith(".tif")
          ) {
            assetKey = key;
            assetHref = asset.href;
            break;
          }
        }
      }

      // If no priority asset found, use first COG asset
      if (!assetHref) {
        for (const [key, asset] of Object.entries(stacItem.assets || {})) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assetObj = asset as any;
          if (
            assetObj.type?.includes("geotiff") ||
            assetObj.type?.includes("image/tiff") ||
            assetObj.href?.endsWith(".tif")
          ) {
            assetKey = key;
            assetHref = assetObj.href;
            break;
          }
        }
      }

      if (!assetHref) {
        throw new Error("No COG/GeoTIFF asset found in item");
      }

      await this._addCogLayer(assetHref, stacItem, assetKey || "default");

      // Fit to item bounds
      if (stacItem.bbox) {
        const [west, south, east, north] = stacItem.bbox;
        this._map.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 50, duration: 1000 },
        );
      }

      this._state.hasLayer = this._cogLayers.size > 0;
      this._state.loading = false;
      this._state.status = `Displayed: ${this._state.selectedItem.id}`;
      this._emit("display", { item: this._state.selectedItem });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to display: ${err instanceof Error ? err.message : String(err)}`;
      this._emit("error", { error: this._state.error });
    }

    this._render();
  }

  /**
   * Display a Planetary Computer item using their TiTiler endpoint.
   * PC requires signed URLs, so we use their tile service instead of direct COG access.
   */
  private async _displayPlanetaryComputerItem(): Promise<void> {
    if (
      !this._map ||
      !this._state.selectedItem ||
      !this._state.selectedCollection
    ) {
      throw new Error("Missing required state for PC display");
    }

    const collection = this._state.selectedCollection.id;
    const itemId = this._state.selectedItem.id;

    // Planetary Computer TiTiler endpoint
    const pcTiTilerBase = "https://planetarycomputer.microsoft.com/api/data/v1";

    // Build visualization parameters based on user selection
    let assetsParam: string;
    let rescaleParam: string;
    let colormap = "";

    if (this._state.isRgbMode) {
      // RGB mode - use selected RGB bands
      // PC TiTiler requires repeated assets= parameters for multi-band
      const { r, g, b } = this._state.rgbBands;
      if (r && g && b) {
        assetsParam = `assets=${r}&assets=${g}&assets=${b}`;
        const rescaleVal = `${this._state.rescaleMin},${this._state.rescaleMax}`;
        rescaleParam = `rescale=${rescaleVal}&rescale=${rescaleVal}&rescale=${rescaleVal}`;
      } else {
        // Fallback to collection defaults if no bands selected
        const defaultAssets = this._getDefaultAssets(collection).split(",");
        assetsParam = defaultAssets.map((a) => `assets=${a}`).join("&");
        rescaleParam = this._getDefaultRescale(collection)
          .split("&")
          .map((r) => (r.startsWith("rescale=") ? r : `rescale=${r}`))
          .join("&");
      }
    } else {
      // Single band mode
      const band = this._state.selectedBand || "data";
      assetsParam = `assets=${band}`;
      rescaleParam = `rescale=${this._state.rescaleMin},${this._state.rescaleMax}`;
      if (this._state.colormap && this._state.colormap !== "none") {
        colormap = `&colormap_name=${this._state.colormap}`;
      }
    }

    // Build tile URL
    const tileUrl = `${pcTiTilerBase}/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?collection=${encodeURIComponent(collection)}&item=${encodeURIComponent(itemId)}&${assetsParam}&${rescaleParam}${colormap}`;

    const layerId = `stac-search-pc-${itemId}-${this._layerCounter++}`;
    const sourceId = `${layerId}-source`;

    // Add raster tile source
    this._map.addSource(sourceId, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
      attribution: "Microsoft Planetary Computer",
    });

    // Add raster layer
    this._map.addLayer({
      id: layerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": 1,
      },
    });

    // Track the layer for removal
    this._cogLayers.set(layerId, { sourceId, layerId, type: "raster" });

    // Fit to item bounds
    if (this._state.selectedItem.bbox) {
      const [west, south, east, north] = this._state.selectedItem.bbox;
      this._map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 50, duration: 1000 },
      );
    }

    this._state.hasLayer = this._cogLayers.size > 0;
    this._state.loading = false;
    this._state.status = `Displayed: ${this._state.selectedItem.id}`;
    this._emit("display", { item: this._state.selectedItem });
    this._render();
  }

  private async _ensureOverlay(): Promise<void> {
    if (this._deckOverlay) return;
    if (!this._map) return;

    const { MapboxOverlay } = await import("@deck.gl/mapbox");
    this._deckOverlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
    });
    (this._map as unknown as { addControl(c: IControl): void }).addControl(
      this._deckOverlay,
    );
  }

  /**
   * Convert S3 URLs to HTTPS URLs for browser access.
   * Handles common S3 URL patterns from various providers.
   */
  private _convertS3ToHttps(url: string): string {
    if (!url.startsWith("s3://")) {
      return url;
    }

    // Parse s3://bucket-name/path format
    const s3Match = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!s3Match) {
      return url;
    }

    const [, bucket, path] = s3Match;

    // Map known buckets to their regions
    const bucketRegions: Record<string, string> = {
      "deafrica-sentinel-2": "af-south-1",
      "deafrica-landsat": "af-south-1",
      "deafrica-services": "af-south-1",
      "dea-public-data": "ap-southeast-2",
      "dea-public-data-dev": "ap-southeast-2",
    };

    const region = bucketRegions[bucket] || "us-east-1";
    return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _addCogLayer(
    href: string,
    stacItem: any,
    assetKey: string,
  ): Promise<void> {
    await this._ensureOverlay();

    // Convert S3 URLs to HTTPS for browser access
    const httpUrl = this._convertS3ToHttps(href);

    const { COGLayer } = await import("@developmentseed/deck.gl-geotiff");

    const layerId = `stac-search-${stacItem.id}-${assetKey}-${this._layerCounter++}`;

    const newLayer = new COGLayer({
      id: layerId,
      geotiff: httpUrl,
      opacity: 1,
    });

    this._cogLayers.set(layerId, newLayer);
    this._deckOverlay.setProps({
      layers: Array.from(this._cogLayers.values()),
    });
  }

  private _removeLayer(layerId: string): void {
    const layer = this._cogLayers.get(layerId);

    if (layer && this._map) {
      // Check if it's a MapLibre raster layer (from Planetary Computer)
      if (layer.type === "raster" && layer.sourceId) {
        if (this._map.getLayer(layer.layerId)) {
          this._map.removeLayer(layer.layerId);
        }
        if (this._map.getSource(layer.sourceId)) {
          this._map.removeSource(layer.sourceId);
        }
      }
    }

    this._cogLayers.delete(layerId);

    // Update deck.gl overlay with remaining COG layers
    if (this._deckOverlay) {
      const deckLayers = Array.from(this._cogLayers.values()).filter(
        (l) => l.type !== "raster",
      );
      this._deckOverlay.setProps({
        layers: deckLayers,
      });
    }

    this._state.hasLayer = this._cogLayers.size > 0;

    // Clear status message if no layers remain
    if (this._cogLayers.size === 0) {
      this._state.status = null;
    }
    this._render();
  }

  private _removeAllLayers(): void {
    const layerIds = Array.from(this._cogLayers.keys());
    for (const layerId of layerIds) {
      this._removeLayer(layerId);
    }
    // Clear the status message when all layers are removed
    this._state.status = null;
    this._render();
  }
}
