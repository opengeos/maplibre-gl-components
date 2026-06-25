import "../styles/common.css";
import "../styles/colorbar.css";
import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  ColorbarItemOptions,
  ColorbarItemState,
  ColorbarOptions,
  ColorbarStackOrientation,
  ColorbarState,
  ComponentEvent,
  ComponentEventHandler,
  ColorStop,
} from "./types";
import { getColormap, isValidColormap } from "../colormaps";
import { formatNumericValue } from "../utils";

/**
 * Default options for the Colorbar control.
 */
type ResolvedColorbarOptions = Required<
  Omit<ColorbarItemOptions, "colorStops">
> & {
  colorStops: ColorStop[];
};

const DEFAULT_OPTIONS: ResolvedColorbarOptions = {
  colormap: "viridis",
  colorStops: [],
  vmin: 0,
  vmax: 1,
  label: "",
  units: "",
  orientation: "vertical",
  barThickness: 20,
  barLength: 200,
  ticks: { count: 5 },
  className: "",
  visible: true,
  opacity: 1,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  fontSize: 11,
  fontColor: "#333",
  borderRadius: 4,
  padding: 8,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * A continuous gradient colorbar control for MapLibre GL maps.
 *
 * Displays a color gradient legend with customizable colormaps,
 * tick marks, labels, and positioning.
 *
 * @example
 * ```typescript
 * const colorbar = new Colorbar({
 *   colormap: 'viridis',
 *   vmin: 0,
 *   vmax: 100,
 *   label: 'Temperature',
 *   units: '°C',
 *   orientation: 'vertical',
 * });
 * map.addControl(colorbar, 'bottom-right');
 * ```
 */
export class Colorbar implements IControl {
  private _container?: HTMLElement;
  private _options: ResolvedColorbarOptions;
  private _colorbarOptions?: ColorbarItemOptions[];
  private _colorbars: ResolvedColorbarOptions[];
  private _stackOrientation: ColorbarStackOrientation = "vertical";
  private _state: ColorbarState;
  private _eventHandlers: Map<
    ComponentEvent,
    Set<ComponentEventHandler<ColorbarState>>
  > = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new Colorbar instance.
   *
   * @param options - Configuration options for the colorbar.
   */
  constructor(options?: ColorbarOptions) {
    const {
      colorbars,
      position: _position,
      stackOrientation,
      ...entryOptions
    } = options ?? {};
    void _position;
    this._options = { ...DEFAULT_OPTIONS, ...entryOptions };
    this._colorbarOptions = colorbars;
    if (stackOrientation) this._stackOrientation = stackOrientation;
    this._colorbars = this._resolveColorbars();
    this._state = this._createState();
  }

  /**
   * Called when the control is added to the map.
   * Implements the IControl interface.
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
   * Implements the IControl interface.
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
   * Shows the colorbar.
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
   * Hides the colorbar.
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
   * Updates the colorbar options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<ColorbarOptions>): void {
    const {
      colorbars,
      position: _position,
      stackOrientation,
      ...entryOptions
    } = options;
    void _position;
    this._options = { ...this._options, ...entryOptions };
    if (stackOrientation !== undefined) {
      this._stackOrientation = stackOrientation;
    }
    if (colorbars !== undefined) {
      this._colorbarOptions = colorbars;
    }
    this._colorbars = this._resolveColorbars();
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Gets the current state.
   *
   * @returns The current colorbar state.
   */
  getState(): ColorbarState {
    return { ...this._state };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(
    event: ComponentEvent,
    handler: ComponentEventHandler<ColorbarState>,
  ): void {
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
    handler: ComponentEventHandler<ColorbarState>,
  ): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Resolves the configured colorbar entries against the control defaults.
   *
   * @returns Array of resolved colorbar options.
   */
  private _resolveColorbars(): ResolvedColorbarOptions[] {
    if (this._colorbarOptions && this._colorbarOptions.length > 0) {
      return this._colorbarOptions.map((colorbar) => ({
        ...this._options,
        ...colorbar,
        colorStops: colorbar.colorStops ?? this._options.colorStops,
      }));
    }

    return [this._options];
  }

  /**
   * Creates public state from the current colorbar entries.
   *
   * @returns The current colorbar state.
   */
  private _createState(): ColorbarState {
    const colorbars = this._colorbars.map((colorbar, index) =>
      this._createColorbarState(colorbar, index),
    );
    return { ...colorbars[0], visible: this._options.visible, colorbars };
  }

  /**
   * Creates public state for a single colorbar entry.
   *
   * @param colorbar - The resolved colorbar options.
   * @returns The current colorbar entry state.
   */
  private _createColorbarState(
    colorbar: ResolvedColorbarOptions,
    index = 0,
  ): ColorbarItemState {
    return {
      visible: this._getColorbarEntryVisible(index, colorbar.visible),
      vmin: colorbar.vmin,
      vmax: colorbar.vmax,
      colormap: colorbar.colormap,
    };
  }

  /**
   * Gets an entry's configured visibility.
   *
   * @param index - The entry index.
   * @param fallback - The fallback visibility value.
   * @returns Whether the entry is configured as visible.
   */
  private _getColorbarEntryVisible(index: number, fallback: boolean): boolean {
    if (this._colorbarOptions && this._colorbarOptions.length > 0) {
      return this._colorbarOptions[index]?.visible ?? true;
    }

    return fallback;
  }

  /**
   * Gets the resolved color stops for the current colormap.
   *
   * @param colorbar - The resolved colorbar options.
   * @returns Array of color stops.
   */
  private _getColorStops(colorbar: ResolvedColorbarOptions): ColorStop[] {
    // Custom color stops take priority
    if (colorbar.colorStops && colorbar.colorStops.length > 0) {
      return colorbar.colorStops;
    }

    const colormap = colorbar.colormap;

    // If colormap is a string array, convert to color stops
    if (Array.isArray(colormap)) {
      return colormap.map((color, i) => ({
        position: i / (colormap.length - 1),
        color,
      }));
    }

    // If colormap is a name, get the built-in colormap
    if (typeof colormap === "string" && isValidColormap(colormap)) {
      return getColormap(colormap);
    }

    // Default to viridis
    return getColormap("viridis");
  }

  /**
   * Generates the CSS gradient string.
   *
   * @param colorbar - The resolved colorbar options.
   * @returns CSS linear-gradient string.
   */
  private _generateGradient(colorbar: ResolvedColorbarOptions): string {
    const stops = this._getColorStops(colorbar);
    const direction =
      colorbar.orientation === "horizontal" ? "to right" : "to top";
    const colorStops = stops
      .map((stop) => `${stop.color} ${stop.position * 100}%`)
      .join(", ");
    return `linear-gradient(${direction}, ${colorStops})`;
  }

  /**
   * Generates tick values.
   *
   * @param colorbar - The resolved colorbar options.
   * @returns Array of tick values.
   */
  private _generateTicks(colorbar: ResolvedColorbarOptions): number[] {
    const { ticks, vmin, vmax } = colorbar;

    if (ticks.values && ticks.values.length > 0) {
      return ticks.values;
    }

    const count = ticks.count || 5;
    const step = (vmax - vmin) / (count - 1);
    return Array.from({ length: count }, (_, i) => vmin + i * step);
  }

  /**
   * Formats a tick value for display.
   *
   * @param value - The tick value.
   * @param colorbar - The resolved colorbar options.
   * @returns Formatted string.
   */
  private _formatTick(
    value: number,
    colorbar: ResolvedColorbarOptions,
  ): string {
    const { ticks, units } = colorbar;

    if (ticks.format) {
      return ticks.format(value);
    }

    // Auto-format based on range
    const range = colorbar.vmax - colorbar.vmin;
    const formatted = formatNumericValue(value, range);

    return units ? `${formatted}${units}` : formatted;
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
    const inRange = this._hasVisibleColorbars();

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
    const shouldShow = this._state.visible && this._hasVisibleColorbars();
    this._container.style.display = shouldShow ? "flex" : "none";
  }

  /**
   * Checks whether a colorbar entry is visible at the current zoom.
   *
   * @param colorbar - The resolved colorbar options.
   * @param index - The colorbar entry index.
   * @returns Whether the colorbar should be rendered.
   */
  private _isColorbarVisible(
    colorbar: ResolvedColorbarOptions,
    index: number,
  ): boolean {
    if (!this._getColorbarEntryVisible(index, colorbar.visible)) return false;
    if (!this._map) return true;

    const zoom = this._map.getZoom();
    return zoom >= colorbar.minzoom && zoom <= colorbar.maxzoom;
  }

  /**
   * Checks whether any colorbar entry should be visible.
   *
   * @returns Whether at least one colorbar should be visible.
   */
  private _hasVisibleColorbars(): boolean {
    if (!this._state.visible) return false;
    return this._colorbars.some((colorbar, index) =>
      this._isColorbarVisible(colorbar, index),
    );
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-colorbar${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = "none";
    }

    return container;
  }

  /**
   * Creates a colorbar entry element.
   *
   * @param colorbar - The resolved colorbar options.
   * @returns The colorbar entry element.
   */
  private _createColorbarElement(
    colorbar: ResolvedColorbarOptions,
  ): HTMLElement {
    const {
      orientation,
      barThickness,
      barLength,
      label,
      backgroundColor,
      opacity,
      fontSize,
      fontColor,
      borderRadius,
      padding,
    } = colorbar;
    const isVertical = orientation === "vertical";
    const ticks = this._generateTicks(colorbar);
    const colorbarEl = document.createElement("div");
    colorbarEl.className = `maplibre-gl-colorbar-entry${
      colorbar.className ? ` ${colorbar.className}` : ""
    }`;

    Object.assign(colorbarEl.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      padding: `${padding}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      display: "flex",
      flexDirection: isVertical ? "row" : "column",
      alignItems: "stretch",
      gap: "6px",
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Add label if provided
    if (label) {
      const labelEl = document.createElement("div");
      labelEl.className = "maplibre-gl-colorbar-label";
      labelEl.textContent = label;
      Object.assign(labelEl.style, {
        fontWeight: "600",
        textAlign: "center",
        marginBottom: isVertical ? "0" : "4px",
        writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
        transform: isVertical ? "rotate(180deg)" : "none",
      });
      colorbarEl.appendChild(labelEl);
    }

    // Create gradient bar with ticks
    const barWrapper = document.createElement("div");
    barWrapper.className = "maplibre-gl-colorbar-bar-wrapper";
    Object.assign(barWrapper.style, {
      display: "flex",
      flexDirection: isVertical ? "row" : "column",
      alignItems: "stretch",
    });

    // Gradient bar
    const bar = document.createElement("div");
    bar.className = "maplibre-gl-colorbar-bar";
    Object.assign(bar.style, {
      background: this._generateGradient(colorbar),
      width: isVertical ? `${barThickness}px` : `${barLength}px`,
      height: isVertical ? `${barLength}px` : `${barThickness}px`,
      borderRadius: "2px",
      border: "1px solid rgba(0, 0, 0, 0.2)",
    });

    // Ticks container
    const ticksContainer = document.createElement("div");
    ticksContainer.className = "maplibre-gl-colorbar-ticks";
    Object.assign(ticksContainer.style, {
      display: "flex",
      flexDirection: isVertical ? "column-reverse" : "row",
      justifyContent: "space-between",
      width: isVertical ? "auto" : `${barLength}px`,
      height: isVertical ? `${barLength}px` : "auto",
      marginLeft: isVertical ? "4px" : "0",
      marginTop: isVertical ? "0" : "4px",
    });

    ticks.forEach((value) => {
      const tick = document.createElement("span");
      tick.className = "maplibre-gl-colorbar-tick";
      tick.textContent = this._formatTick(value, colorbar);
      tick.style.fontSize = `${fontSize - 1}px`;
      ticksContainer.appendChild(tick);
    });

    barWrapper.appendChild(bar);
    barWrapper.appendChild(ticksContainer);
    colorbarEl.appendChild(barWrapper);

    return colorbarEl;
  }

  /**
   * Renders the colorbar content.
   */
  private _render(): void {
    if (!this._container) return;

    this._container.innerHTML = "";

    const shouldShow = this._hasVisibleColorbars();
    const isHorizontalStack = this._stackOrientation === "horizontal";
    Object.assign(this._container.style, {
      display: shouldShow ? "flex" : "none",
      flexDirection: isHorizontalStack ? "row" : "column",
      alignItems: isHorizontalStack ? "flex-end" : "stretch",
      gap: "8px",
      background: "transparent",
      boxShadow: "none",
      padding: "0",
    });

    this._colorbars.forEach((colorbar, index) => {
      if (this._isColorbarVisible(colorbar, index)) {
        this._container?.appendChild(this._createColorbarElement(colorbar));
      }
    });
  }
}
