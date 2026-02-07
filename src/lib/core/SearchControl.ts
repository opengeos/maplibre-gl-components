import "../styles/common.css";
import "../styles/search-control.css";
import type { IControl, Map as MapLibreMap, Marker } from "maplibre-gl";
import type {
  SearchControlOptions,
  SearchControlState,
  SearchResult,
  SearchEvent,
  SearchEventHandler,
} from "./types";

/**
 * Default Nominatim geocoding URL (OpenStreetMap).
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Default options for the SearchControl.
 */
const DEFAULT_OPTIONS: Required<Omit<SearchControlOptions, "geocoder">> & {
  geocoder?: SearchControlOptions["geocoder"];
} = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  placeholder: "Search places...",
  geocoderUrl: NOMINATIM_URL,
  maxResults: 5,
  debounceMs: 300,
  flyToZoom: 14,
  showMarker: true,
  markerColor: "#4264fb",
  collapseOnSelect: true,
  clearOnSelect: true,
  geocoder: undefined,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  width: 280,
  fontSize: 13,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * A collapsible search control for MapLibre GL maps.
 *
 * Provides place search functionality using Nominatim (or custom geocoder).
 * Shows a search icon that expands to reveal a search input with autocomplete results.
 *
 * @example
 * ```typescript
 * const searchControl = new SearchControl({
 *   placeholder: 'Search for a place...',
 *   flyToZoom: 12,
 *   showMarker: true,
 * });
 * map.addControl(searchControl, 'top-right');
 *
 * // Listen for result selection
 * searchControl.on('resultselect', (event) => {
 *   console.log('Selected:', event.result);
 * });
 * ```
 */
export class SearchControl implements IControl {
  private _container?: HTMLElement;
  private _inputEl?: HTMLInputElement;
  private _inputWrapper?: HTMLElement;
  private _resultsContainer?: HTMLElement;
  private _loadingEl?: HTMLElement;
  private _clearBtn?: HTMLButtonElement;
  private _options: Required<Omit<SearchControlOptions, "geocoder">> & {
    geocoder?: SearchControlOptions["geocoder"];
  };
  private _state: SearchControlState;
  private _eventHandlers: Map<SearchEvent, Set<SearchEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _marker?: Marker;
  private _debounceTimer?: ReturnType<typeof setTimeout>;

  /**
   * Creates a new SearchControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: SearchControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      query: "",
      results: [],
      loading: false,
      selectedResult: null,
      error: null,
    };
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
    this._render();

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);

    // Check initial zoom
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
    this._removeMarker();
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._inputEl = undefined;
    this._inputWrapper = undefined;
    this._resultsContainer = undefined;
    this._loadingEl = undefined;
    this._clearBtn = undefined;
    this._eventHandlers.clear();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
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
   * Expands the search control to show the input.
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit("expand");
      // Focus the input when expanded
      setTimeout(() => this._inputEl?.focus(), 50);
    }
  }

  /**
   * Collapses the search control to icon only.
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._state.results = [];
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
   * Performs a search with the given query.
   *
   * @param query - The search query string.
   */
  async search(query: string): Promise<void> {
    this._state.query = query;

    if (!query.trim()) {
      this._state.results = [];
      this._state.error = null;
      this._updateLoadingState();
      this._renderResultsOnly();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._updateLoadingState();
    this._renderResultsOnly();

    try {
      let results: SearchResult[];

      if (this._options.geocoder) {
        // Use custom geocoder
        results = await this._options.geocoder(query);
      } else {
        // Use Nominatim
        results = await this._nominatimSearch(query);
      }

      // Check if query has changed while we were waiting (user typed something new)
      if (this._state.query !== query) {
        return; // Discard stale results
      }

      this._state.results = results.slice(0, this._options.maxResults);
      this._state.loading = false;
      this._updateLoadingState();
      this._renderResultsOnly();
      this._emit("search");
    } catch (error) {
      // Check if query has changed while we were waiting
      if (this._state.query !== query) {
        return; // Discard stale error
      }

      this._state.loading = false;
      this._state.error =
        error instanceof Error ? error.message : "Search failed";
      this._state.results = [];
      this._updateLoadingState();
      this._renderResultsOnly();
    }
  }

  /**
   * Selects a search result and flies to its location.
   *
   * @param result - The search result to select.
   */
  selectResult(result: SearchResult): void {
    this._state.selectedResult = result;

    if (this._map) {
      // Fly to the result location
      if (result.bbox) {
        this._map.fitBounds(
          [
            [result.bbox[0], result.bbox[1]],
            [result.bbox[2], result.bbox[3]],
          ],
          { padding: 50, maxZoom: this._options.flyToZoom },
        );
      } else {
        this._map.flyTo({
          center: [result.lng, result.lat],
          zoom: this._options.flyToZoom,
        });
      }

      // Add marker if enabled
      if (this._options.showMarker) {
        this._addMarker(result);
      }
    }

    if (this._options.clearOnSelect) {
      this._state.query = "";
      this._state.results = [];
    }

    if (this._options.collapseOnSelect) {
      this._state.collapsed = true;
    }

    this._render();
    this._emit("resultselect", result);
  }

  /**
   * Clears the search query and results.
   */
  clear(): void {
    this._state.query = "";
    this._state.results = [];
    this._state.selectedResult = null;
    this._state.error = null;
    this._state.loading = false;
    this._removeMarker();

    // Update input value directly if it exists
    if (this._inputEl) {
      this._inputEl.value = "";
    }

    // Use partial rendering to avoid losing focus
    this._updateLoadingState();
    this._renderResultsOnly();
    this._emit("clear");
  }

  /**
   * Gets the current state.
   *
   * @returns The current control state.
   */
  getState(): SearchControlState {
    return { ...this._state, results: [...this._state.results] };
  }

  /**
   * Updates control options.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<SearchControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined)
      this._state.collapsed = options.collapsed;
    this._render();
    this._emit("update");
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: SearchEvent, handler: SearchEventHandler): void {
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
  off(event: SearchEvent, handler: SearchEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emits an event to all registered handlers.
   */
  private _emit(event: SearchEvent, result?: SearchResult): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState(), result };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Performs a search using Nominatim geocoding service.
   */
  private async _nominatimSearch(query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: String(this._options.maxResults),
      addressdetails: "1",
    });

    const response = await fetch(`${this._options.geocoderUrl}?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map(
      (item: {
        place_id: number;
        display_name: string;
        name?: string;
        lon: string;
        lat: string;
        boundingbox?: string[];
        type?: string;
        importance?: number;
      }) => ({
        id: String(item.place_id),
        name: item.name || item.display_name.split(",")[0],
        displayName: item.display_name,
        lng: parseFloat(item.lon),
        lat: parseFloat(item.lat),
        bbox: item.boundingbox
          ? ([
              parseFloat(item.boundingbox[2]),
              parseFloat(item.boundingbox[0]),
              parseFloat(item.boundingbox[3]),
              parseFloat(item.boundingbox[1]),
            ] as [number, number, number, number])
          : undefined,
        type: item.type,
        importance: item.importance,
      }),
    );
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
   * Adds a marker at the result location.
   */
  private _addMarker(result: SearchResult): void {
    this._removeMarker();

    if (!this._map) return;

    // Import maplibre-gl dynamically to avoid circular dependencies
    import("maplibre-gl").then(({ Marker }) => {
      // Create custom marker element
      const el = document.createElement("div");
      el.className = "maplibre-gl-search-marker";
      el.innerHTML = `
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${this._options.markerColor}"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
        </svg>
      `;
      el.style.cursor = "pointer";

      this._marker = new Marker({ element: el })
        .setLngLat([result.lng, result.lat])
        .addTo(this._map!);
    });
  }

  /**
   * Removes the current marker.
   */
  private _removeMarker(): void {
    if (this._marker) {
      this._marker.remove();
      this._marker = undefined;
    }
  }

  /**
   * Updates only the results section without rebuilding the entire DOM.
   * This prevents input focus loss during search.
   */
  private _renderResultsOnly(): void {
    if (!this._container || this._state.collapsed) return;

    // Remove existing results container if present
    if (this._resultsContainer) {
      this._resultsContainer.remove();
      this._resultsContainer = undefined;
    }

    // Remove existing error element if present
    const existingError = this._container.querySelector(
      ".maplibre-gl-search-error",
    );
    if (existingError) {
      existingError.remove();
    }

    // Render error if present
    if (this._state.error) {
      const errorEl = document.createElement("div");
      errorEl.className = "maplibre-gl-search-error";
      errorEl.textContent = this._state.error;
      Object.assign(errorEl.style, {
        padding: "8px 10px",
        color: "#d32f2f",
        fontSize: "12px",
        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
      });
      this._container.appendChild(errorEl);
    }

    // Render results if present
    if (this._state.results.length > 0) {
      this._resultsContainer = document.createElement("div");
      this._resultsContainer.className = "maplibre-gl-search-results";
      Object.assign(this._resultsContainer.style, {
        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
        maxHeight: "250px",
        overflowY: "auto",
      });

      this._state.results.forEach((result) => {
        const resultEl = document.createElement("div");
        resultEl.className = "maplibre-gl-search-result";
        Object.assign(resultEl.style, {
          padding: "10px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          transition: "background-color 0.15s ease",
        });

        // Location icon
        const icon = document.createElement("span");
        icon.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        `;
        icon.style.color = "#888";
        resultEl.appendChild(icon);

        // Text content
        const textWrapper = document.createElement("div");
        textWrapper.style.flex = "1";
        textWrapper.style.minWidth = "0";

        const nameEl = document.createElement("div");
        nameEl.className = "maplibre-gl-search-result-name";
        nameEl.textContent = result.name;
        Object.assign(nameEl.style, {
          fontWeight: "500",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        textWrapper.appendChild(nameEl);

        const detailEl = document.createElement("div");
        detailEl.className = "maplibre-gl-search-result-detail";
        detailEl.textContent = result.displayName;
        Object.assign(detailEl.style, {
          fontSize: "11px",
          color: "#666",
          marginTop: "2px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        textWrapper.appendChild(detailEl);

        resultEl.appendChild(textWrapper);

        resultEl.addEventListener("mouseenter", () => {
          resultEl.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
        });
        resultEl.addEventListener("mouseleave", () => {
          resultEl.style.backgroundColor = "transparent";
        });
        resultEl.addEventListener("click", () => this.selectResult(result));

        this._resultsContainer!.appendChild(resultEl);
      });

      this._container.appendChild(this._resultsContainer);
    }
  }

  /**
   * Updates only the loading/clear button state without full DOM rebuild.
   */
  private _updateLoadingState(): void {
    if (!this._inputWrapper) return;

    // Remove existing loading element
    if (this._loadingEl) {
      this._loadingEl.remove();
      this._loadingEl = undefined;
    }

    // Remove existing clear button
    if (this._clearBtn) {
      this._clearBtn.remove();
      this._clearBtn = undefined;
    }

    // Find the collapse button to insert before it
    const collapseBtn = this._inputWrapper.querySelector(
      ".maplibre-gl-search-collapse",
    );

    if (this._state.loading) {
      this._loadingEl = document.createElement("span");
      this._loadingEl.className = "maplibre-gl-search-loader";
      this._loadingEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
          </path>
        </svg>
      `;
      Object.assign(this._loadingEl.style, {
        display: "flex",
        alignItems: "center",
        color: "#888",
        flexShrink: "0",
      });
      if (collapseBtn) {
        this._inputWrapper.insertBefore(this._loadingEl, collapseBtn);
      } else {
        this._inputWrapper.appendChild(this._loadingEl);
      }
    } else if (this._state.query) {
      this._clearBtn = document.createElement("button");
      this._clearBtn.className = "maplibre-gl-search-clear";
      this._clearBtn.type = "button";
      this._clearBtn.title = "Clear";
      this._clearBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      `;
      Object.assign(this._clearBtn.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        padding: "4px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#888",
        flexShrink: "0",
      });
      this._clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clear();
      });
      if (collapseBtn) {
        this._inputWrapper.insertBefore(this._clearBtn, collapseBtn);
      } else {
        this._inputWrapper.appendChild(this._clearBtn);
      }
    }
  }

  /**
   * Creates the main container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-search${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = "none";
    }

    return container;
  }

  /**
   * Handles input change with debouncing.
   */
  private _handleInput = (e: Event): void => {
    const value = (e.target as HTMLInputElement).value;
    this._state.query = value;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this.search(value);
    }, this._options.debounceMs);
  };

  /**
   * Renders the control content.
   */
  private _render(): void {
    if (!this._container) return;

    const {
      backgroundColor,
      borderRadius,
      opacity,
      width,
      fontSize,
      fontColor,
      placeholder,
    } = this._options;

    // Clear existing content and DOM references
    this._container.innerHTML = "";
    this._inputEl = undefined;
    this._inputWrapper = undefined;
    this._resultsContainer = undefined;
    this._loadingEl = undefined;
    this._clearBtn = undefined;

    // Apply base container styles
    Object.assign(this._container.style, {
      backgroundColor,
      borderRadius: `${borderRadius}px`,
      opacity: String(opacity),
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: `${fontSize}px`,
      color: fontColor,
      overflow: "hidden",
    });

    if (this._state.collapsed) {
      // Collapsed state - just show the search icon
      this._container.style.width = "auto";
      this._renderCollapsedState();
    } else {
      // Expanded state - show search input and results
      Object.assign(this._container.style, {
        width: `${width}px`,
      });
      this._renderExpandedState(placeholder, fontColor);
    }
  }

  /**
   * Renders the collapsed state (search icon only).
   */
  private _renderCollapsedState(): void {
    const button = document.createElement("button");
    button.className = "maplibre-gl-search-toggle";
    button.type = "button";
    button.title = "Search places";
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
    `;
    Object.assign(button.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "30px",
      height: "30px",
      padding: "0",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: this._options.fontColor,
    });
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.expand();
    });
    this._container!.appendChild(button);
  }

  /**
   * Renders the expanded state (search input and results).
   */
  private _renderExpandedState(placeholder: string, fontColor: string): void {
    // Search input wrapper
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "maplibre-gl-search-input-wrapper";
    Object.assign(inputWrapper.style, {
      display: "flex",
      alignItems: "center",
      padding: "0 10px",
      gap: "8px",
      height: "30px",
      boxSizing: "border-box",
    });

    // Search icon
    const searchIcon = document.createElement("span");
    searchIcon.className = "maplibre-gl-search-icon";
    searchIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
    `;
    Object.assign(searchIcon.style, {
      display: "flex",
      alignItems: "center",
      color: "#888",
      flexShrink: "0",
    });
    inputWrapper.appendChild(searchIcon);

    // Input element
    const input = document.createElement("input");
    input.type = "text";
    input.className = "maplibre-gl-search-input";
    input.placeholder = placeholder;
    input.value = this._state.query;
    Object.assign(input.style, {
      flex: "1",
      border: "none",
      outline: "none",
      background: "transparent",
      fontSize: "inherit",
      color: fontColor,
      minWidth: "0",
    });
    input.addEventListener("input", this._handleInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.collapse();
      }
    });
    this._inputEl = input;
    inputWrapper.appendChild(input);

    // Loading indicator or clear button
    if (this._state.loading) {
      const loader = document.createElement("span");
      loader.className = "maplibre-gl-search-loader";
      loader.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
          </path>
        </svg>
      `;
      Object.assign(loader.style, {
        display: "flex",
        alignItems: "center",
        color: "#888",
        flexShrink: "0",
      });
      inputWrapper.appendChild(loader);
    } else if (this._state.query) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "maplibre-gl-search-clear";
      clearBtn.type = "button";
      clearBtn.title = "Clear";
      clearBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      `;
      Object.assign(clearBtn.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        padding: "4px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#888",
        flexShrink: "0",
      });
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clear();
      });
      inputWrapper.appendChild(clearBtn);
    }

    // Collapse button
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "maplibre-gl-search-collapse";
    collapseBtn.type = "button";
    collapseBtn.title = "Close";
    collapseBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    `;
    Object.assign(collapseBtn.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "24px",
      height: "24px",
      padding: "4px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#888",
      flexShrink: "0",
    });
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapse();
    });
    inputWrapper.appendChild(collapseBtn);

    // Store reference for partial rendering
    this._inputWrapper = inputWrapper;
    this._container!.appendChild(inputWrapper);

    // Error message
    if (this._state.error) {
      const errorEl = document.createElement("div");
      errorEl.className = "maplibre-gl-search-error";
      errorEl.textContent = this._state.error;
      Object.assign(errorEl.style, {
        padding: "8px 10px",
        color: "#d32f2f",
        fontSize: "12px",
        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
      });
      this._container!.appendChild(errorEl);
    }

    // Results list
    if (this._state.results.length > 0) {
      const resultsEl = document.createElement("div");
      resultsEl.className = "maplibre-gl-search-results";
      Object.assign(resultsEl.style, {
        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
        maxHeight: "250px",
        overflowY: "auto",
      });

      this._state.results.forEach((result) => {
        const resultEl = document.createElement("div");
        resultEl.className = "maplibre-gl-search-result";
        Object.assign(resultEl.style, {
          padding: "10px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          transition: "background-color 0.15s ease",
        });

        // Location icon
        const icon = document.createElement("span");
        icon.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        `;
        icon.style.color = "#888";
        resultEl.appendChild(icon);

        // Text content
        const textWrapper = document.createElement("div");
        textWrapper.style.flex = "1";
        textWrapper.style.minWidth = "0";

        const nameEl = document.createElement("div");
        nameEl.className = "maplibre-gl-search-result-name";
        nameEl.textContent = result.name;
        Object.assign(nameEl.style, {
          fontWeight: "500",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        textWrapper.appendChild(nameEl);

        const detailEl = document.createElement("div");
        detailEl.className = "maplibre-gl-search-result-detail";
        detailEl.textContent = result.displayName;
        Object.assign(detailEl.style, {
          fontSize: "11px",
          color: "#666",
          marginTop: "2px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        textWrapper.appendChild(detailEl);

        resultEl.appendChild(textWrapper);

        resultEl.addEventListener("mouseenter", () => {
          resultEl.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
        });
        resultEl.addEventListener("mouseleave", () => {
          resultEl.style.backgroundColor = "transparent";
        });
        resultEl.addEventListener("click", () => this.selectResult(result));

        resultsEl.appendChild(resultEl);
      });

      this._container!.appendChild(resultsEl);
    }
  }
}
