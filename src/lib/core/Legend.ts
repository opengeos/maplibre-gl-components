import "../styles/common.css";
import "../styles/legend.css";
import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  LegendItemOptions,
  LegendItemState,
  LegendOptions,
  LegendState,
  LegendItem,
  ComponentEvent,
  ComponentEventHandler,
} from "./types";

/**
 * Default options for the Legend control.
 */
type ResolvedLegendOptions = Required<LegendItemOptions>;

const DEFAULT_OPTIONS: ResolvedLegendOptions = {
  title: "",
  items: [],
  className: "",
  visible: true,
  collapsible: false,
  collapsed: false,
  width: 200,
  maxHeight: 300,
  opacity: 1,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  fontSize: 12,
  fontColor: "#333",
  swatchSize: 16,
  borderRadius: 4,
  padding: 10,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * A categorical legend control for MapLibre GL maps.
 *
 * Displays discrete legend items with color swatches and labels.
 *
 * @example
 * ```typescript
 * const legend = new Legend({
 *   title: 'Land Use',
 *   items: [
 *     { label: 'Residential', color: '#ff6b6b' },
 *     { label: 'Commercial', color: '#4ecdc4' },
 *     { label: 'Industrial', color: '#95a5a6' },
 *   ],
 * });
 * map.addControl(legend, 'bottom-left');
 * ```
 */
export class Legend implements IControl {
  private _container?: HTMLElement;
  private _options: ResolvedLegendOptions;
  private _legendOptions?: LegendItemOptions[];
  private _legends: ResolvedLegendOptions[];
  private _state: LegendState;
  private _eventHandlers: Map<
    ComponentEvent,
    Set<ComponentEventHandler<LegendState>>
  > = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new Legend instance.
   *
   * @param options - Configuration options for the legend.
   */
  constructor(options?: LegendOptions) {
    const { legends, position: _position, ...entryOptions } = options ?? {};
    void _position;
    this._options = { ...DEFAULT_OPTIONS, ...entryOptions };
    this._legendOptions = legends;
    this._legends = this._resolveLegends();
    this._state = this._createState();
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
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Shows the legend.
   */
  show(): void {
    if (!this._state.visible) {
      this._options.visible = true;
      this._state = this._createState();
      this._updateDisplayState();
      this._emit("show");
    }
  }

  /**
   * Hides the legend.
   */
  hide(): void {
    if (this._state.visible) {
      this._options.visible = false;
      this._state = this._createState();
      this._updateDisplayState();
      this._emit("hide");
    }
  }

  /**
   * Expands the legend (if collapsible).
   */
  expand(): void {
    if (this._state.collapsed) {
      this._options.collapsed = false;
      this._legends[0].collapsed = false;
      if (this._legendOptions?.[0]) {
        this._legendOptions[0].collapsed = false;
      }
      this._state = this._createState();
      this._render();
      this._emit("expand");
    }
  }

  /**
   * Collapses the legend (if collapsible).
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._options.collapsed = true;
      this._legends[0].collapsed = true;
      if (this._legendOptions?.[0]) {
        this._legendOptions[0].collapsed = true;
      }
      this._state = this._createState();
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
   * Updates the legend items.
   *
   * @param items - New legend items.
   */
  setItems(items: LegendItem[]): void {
    this._options.items = [...items];
    this._legends[0].items = [...items];
    if (this._legendOptions?.[0]) {
      this._legendOptions[0].items = [...items];
    }
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Adds a legend item.
   *
   * @param item - Legend item to add.
   */
  addItem(item: LegendItem): void {
    this._options.items.push(item);
    this._legends[0].items.push(item);
    if (this._legendOptions?.[0]) {
      this._legendOptions[0].items = [
        ...(this._legendOptions[0].items ?? []),
        item,
      ];
    }
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Removes a legend item by label.
   *
   * @param label - Label of the item to remove.
   */
  removeItem(label: string): void {
    const items = this._legends[0].items.filter(
      (item) => item.label !== label,
    );
    this._options.items = [...items];
    this._legends[0].items = [...items];
    if (this._legendOptions?.[0]) {
      this._legendOptions[0].items = [...items];
    }
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Updates legend options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<LegendOptions>): void {
    const { legends, position: _position, ...entryOptions } = options;
    void _position;
    this._options = { ...this._options, ...entryOptions };
    if (legends !== undefined) {
      this._legendOptions = legends;
    }
    this._legends = this._resolveLegends();
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Gets the current state.
   *
   * @returns The current legend state.
   */
  getState(): LegendState {
    return {
      ...this._state,
      items: [...this._state.items],
      legends: this._state.legends?.map((legend) => ({
        ...legend,
        items: [...legend.items],
      })),
    };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: ComponentEvent, handler: ComponentEventHandler<LegendState>): void {
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
  off(
    event: ComponentEvent,
    handler: ComponentEventHandler<LegendState>,
  ): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Resolves configured legend entries against the control defaults.
   *
   * @returns Array of resolved legend options.
   */
  private _resolveLegends(): ResolvedLegendOptions[] {
    if (this._legendOptions && this._legendOptions.length > 0) {
      return this._legendOptions.map((legend) => ({
        ...this._options,
        ...legend,
        items: legend.items ? [...legend.items] : [...this._options.items],
      }));
    }

    return [{ ...this._options, items: [...this._options.items] }];
  }

  /**
   * Creates public state from the current legend entries.
   *
   * @returns The current legend state.
   */
  private _createState(): LegendState {
    const legends = this._legends.map((legend, index) =>
      this._createLegendState(legend, index),
    );
    return { ...legends[0], visible: this._options.visible, legends };
  }

  /**
   * Creates public state for a single legend entry.
   *
   * @param legend - The resolved legend options.
   * @param index - The legend entry index.
   * @returns The current legend entry state.
   */
  private _createLegendState(
    legend: ResolvedLegendOptions,
    index: number,
  ): LegendItemState {
    return {
      visible: this._getLegendEntryVisible(index, legend.visible),
      collapsed: legend.collapsed,
      items: [...legend.items],
    };
  }

  /**
   * Gets an entry's configured visibility.
   *
   * @param index - The entry index.
   * @param fallback - The fallback visibility value.
   * @returns Whether the entry is configured as visible.
   */
  private _getLegendEntryVisible(index: number, fallback: boolean): boolean {
    if (this._legendOptions && this._legendOptions.length > 0) {
      return this._legendOptions[index]?.visible ?? true;
    }

    return fallback;
  }

  /**
   * Emits an event to all registered handlers.
   *
   * @param event - The event type to emit.
   */
  private _emit(event: ComponentEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState() };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Checks if the current zoom level is within the visibility range.
   */
  private _checkZoomVisibility(): void {
    const inRange = this._hasVisibleLegends();

    if (inRange !== this._zoomVisible) {
      this._zoomVisible = inRange;
      this._render();
    }
  }

  /**
   * Updates the display state based on visibility and zoom level.
   */
  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._hasVisibleLegends();
    this._container.style.display = shouldShow ? "flex" : "none";
  }

  /**
   * Checks whether a legend entry is visible at the current zoom.
   *
   * @param legend - The resolved legend options.
   * @param index - The legend entry index.
   * @returns Whether the legend should be rendered.
   */
  private _isLegendVisible(
    legend: ResolvedLegendOptions,
    index: number,
  ): boolean {
    if (!this._getLegendEntryVisible(index, legend.visible)) return false;
    if (!this._map) return true;

    const zoom = this._map.getZoom();
    return zoom >= legend.minzoom && zoom <= legend.maxzoom;
  }

  /**
   * Checks whether any legend entry should be visible.
   *
   * @returns Whether at least one legend should be visible.
   */
  private _hasVisibleLegends(): boolean {
    if (!this._state.visible) return false;
    return this._legends.some((legend, index) =>
      this._isLegendVisible(legend, index),
    );
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-legend${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = "none";
    }

    return container;
  }

  /**
   * Creates a color swatch element.
   *
   * @param item - Legend item configuration.
   * @param legend - The resolved legend options.
   * @returns The swatch element.
   */
  private _createSwatch(
    item: LegendItem,
    legend: ResolvedLegendOptions,
  ): HTMLElement {
    const { swatchSize = 16 } = legend;
    const shape = item.shape || "square";
    const swatch = document.createElement("span");
    swatch.className = `maplibre-gl-legend-swatch maplibre-gl-legend-swatch-${shape}`;

    // Base styles
    const baseStyles: Record<string, string> = {
      flexShrink: "0",
      display: "inline-block",
    };

    if (shape === "line") {
      // Line shape: horizontal line with rounded ends
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: "4px",
        backgroundColor: item.color,
        borderRadius: "2px",
        border: "none",
        alignSelf: "center",
      });
    } else if (shape === "circle") {
      // Circle shape
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
        backgroundColor: item.color,
        borderRadius: "50%",
        border: item.strokeColor
          ? `2px solid ${item.strokeColor}`
          : "1px solid rgba(0,0,0,0.1)",
      });
    } else {
      // Square shape (default)
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
        backgroundColor: item.color,
        borderRadius: "2px",
        border: item.strokeColor
          ? `2px solid ${item.strokeColor}`
          : "1px solid rgba(0,0,0,0.1)",
      });
    }

    // If icon is provided, use background image
    if (item.icon) {
      Object.assign(swatch.style, {
        backgroundImage: `url(${item.icon})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundColor: "transparent",
        border: "none",
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
      });
    }

    return swatch;
  }

  /**
   * Toggles a legend entry.
   *
   * @param index - The legend entry index.
   */
  private _toggleLegend(index: number): void {
    const legend = this._legends[index];
    if (!legend) return;

    legend.collapsed = !legend.collapsed;
    if (index === 0) {
      this._options.collapsed = legend.collapsed;
      if (this._legendOptions?.[0]) {
        this._legendOptions[0].collapsed = legend.collapsed;
      }
    }
    this._state = this._createState();
    this._render();
    this._emit(legend.collapsed ? "collapse" : "expand");
  }

  /**
   * Creates a legend entry element.
   *
   * @param legend - The resolved legend options.
   * @param index - The legend entry index.
   * @returns The legend entry element.
   */
  private _createLegendElement(
    legend: ResolvedLegendOptions,
    index: number,
  ): HTMLElement {
    const {
      title,
      backgroundColor,
      opacity,
      fontSize,
      fontColor,
      borderRadius,
      padding,
      width,
      maxHeight,
      collapsible,
      className,
    } = legend;
    const legendEl = document.createElement("div");
    legendEl.className = `maplibre-gl-legend-entry${
      className ? ` ${className}` : ""
    }`;

    // Apply container styles
    // When collapsed with header, use minimal vertical padding to match HtmlControl
    const isCollapsedWithHeader = legend.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 4 : padding;
    Object.assign(legendEl.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${padding}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      width: isCollapsedWithHeader ? "auto" : `${width}px`,
      maxWidth: `${width}px`,
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      display: "block",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Add title/header
    if (title || collapsible) {
      const header = document.createElement("div");
      header.className = "maplibre-gl-legend-header";
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: legend.collapsed ? "0" : "4px",
        cursor: collapsible ? "pointer" : "default",
      });

      if (title) {
        const titleEl = document.createElement("span");
        titleEl.className = "maplibre-gl-legend-title";
        titleEl.textContent = title;
        titleEl.style.fontWeight = "600";
        header.appendChild(titleEl);
      }

      if (collapsible) {
        const toggleBtn = document.createElement("span");
        toggleBtn.className = "maplibre-gl-legend-toggle";
        toggleBtn.innerHTML = legend.collapsed ? "&#9654;" : "&#9660;";
        toggleBtn.style.marginLeft = "8px";
        header.appendChild(toggleBtn);
        header.addEventListener("click", () => this._toggleLegend(index));
      }

      legendEl.appendChild(header);
    }

    // Content area
    const content = document.createElement("div");
    content.className = "maplibre-gl-legend-content";
    Object.assign(content.style, {
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
      display: legend.collapsed ? "none" : "block",
    });

    // Render legend items
    legend.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "maplibre-gl-legend-item";
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 0",
      });

      const swatch = this._createSwatch(item, legend);
      const label = document.createElement("span");
      label.className = "maplibre-gl-legend-label";
      label.textContent = item.label;

      row.appendChild(swatch);
      row.appendChild(label);
      content.appendChild(row);
    });

    legendEl.appendChild(content);

    return legendEl;
  }

  /**
   * Renders the legend content.
   */
  private _render(): void {
    if (!this._container) return;

    this._container.innerHTML = "";

    const shouldShow = this._hasVisibleLegends();
    Object.assign(this._container.style, {
      display: shouldShow ? "flex" : "none",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "8px",
      background: "transparent",
      boxShadow: "none",
      padding: "0",
    });

    this._legends.forEach((legend, index) => {
      if (this._isLegendVisible(legend, index)) {
        this._container?.appendChild(this._createLegendElement(legend, index));
      }
    });
  }
}
