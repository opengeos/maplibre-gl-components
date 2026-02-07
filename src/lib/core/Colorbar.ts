import "../styles/common.css";
import "../styles/colorbar.css";
import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  ColorbarOptions,
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
const DEFAULT_OPTIONS: Required<Omit<ColorbarOptions, "colorStops">> & {
  colorStops: ColorStop[];
} = {
  colormap: "viridis",
  colorStops: [],
  vmin: 0,
  vmax: 1,
  label: "",
  units: "",
  orientation: "vertical",
  position: "bottom-right",
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
  private _options: Required<Omit<ColorbarOptions, "colorStops">> & {
    colorStops: ColorStop[];
  };
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
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      vmin: this._options.vmin,
      vmax: this._options.vmax,
      colormap: this._options.colormap,
    };
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
      this._state.visible = true;
      this._updateDisplayState();
      this._emit("show");
    }
  }

  /**
   * Hides the colorbar.
   */
  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
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
    this._options = { ...this._options, ...options };
    if (options.vmin !== undefined) this._state.vmin = options.vmin;
    if (options.vmax !== undefined) this._state.vmax = options.vmax;
    if (options.colormap !== undefined) this._state.colormap = options.colormap;
    if (options.visible !== undefined) this._state.visible = options.visible;
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
   * Gets the resolved color stops for the current colormap.
   *
   * @returns Array of color stops.
   */
  private _getColorStops(): ColorStop[] {
    // Custom color stops take priority
    if (this._options.colorStops && this._options.colorStops.length > 0) {
      return this._options.colorStops;
    }

    const colormap = this._options.colormap;

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
   * @returns CSS linear-gradient string.
   */
  private _generateGradient(): string {
    const stops = this._getColorStops();
    const direction =
      this._options.orientation === "horizontal" ? "to right" : "to top";
    const colorStops = stops
      .map((stop) => `${stop.color} ${stop.position * 100}%`)
      .join(", ");
    return `linear-gradient(${direction}, ${colorStops})`;
  }

  /**
   * Generates tick values.
   *
   * @returns Array of tick values.
   */
  private _generateTicks(): number[] {
    const { ticks, vmin, vmax } = this._options;

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
   * @returns Formatted string.
   */
  private _formatTick(value: number): string {
    const { ticks, units } = this._options;

    if (ticks.format) {
      return ticks.format(value);
    }

    // Auto-format based on range
    const range = this._options.vmax - this._options.vmin;
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
    this._container.style.display = shouldShow ? "flex" : "none";
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
   * Renders the colorbar content.
   */
  private _render(): void {
    if (!this._container) return;

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
    } = this._options;
    const isVertical = orientation === "vertical";
    const ticks = this._generateTicks();

    // Clear existing content
    this._container.innerHTML = "";

    // Apply container styles
    const shouldShow = this._state.visible && this._zoomVisible;
    Object.assign(this._container.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      padding: `${padding}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      display: shouldShow ? "flex" : "none",
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
      this._container.appendChild(labelEl);
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
      background: this._generateGradient(),
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
      tick.textContent = this._formatTick(value);
      tick.style.fontSize = `${fontSize - 1}px`;
      ticksContainer.appendChild(tick);
    });

    barWrapper.appendChild(bar);
    barWrapper.appendChild(ticksContainer);
    this._container.appendChild(barWrapper);
  }
}
