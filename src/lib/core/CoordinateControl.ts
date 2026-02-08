import "../styles/common.css";
import "../styles/coordinate-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  MapMouseEvent,
  ControlPosition,
} from "maplibre-gl";
import type {
  CoordinateControlOptions,
  CoordinateControlState,
  CoordinateEvent,
  CoordinateEventHandler,
  CoordinateFormat,
} from "./types";

/**
 * Default options for the CoordinateControl.
 */
const DEFAULT_OPTIONS: Required<CoordinateControlOptions> = {
  position: "bottom-left",
  className: "",
  visible: true,
  format: "decimal",
  precision: 6,
  showElevation: false,
  showZoom: false,
  lngLabel: "Lng",
  latLabel: "Lat",
  copyOnClick: true,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  borderRadius: 4,
  fontSize: 12,
  fontColor: "#333",
  padding: 6,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * Format options for display.
 */
const FORMAT_LABELS: Record<CoordinateFormat, string> = {
  decimal: "DD",
  dms: "DMS",
  ddm: "DDM",
};

/**
 * Check icon for copy feedback.
 */
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * Convert decimal degrees to DMS (degrees, minutes, seconds).
 */
function decimalToDMS(decimal: number, isLat: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);

  const direction = isLat
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
      ? "E"
      : "W";

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Convert decimal degrees to DDM (degrees, decimal minutes).
 */
function decimalToDDM(decimal: number, isLat: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutes = ((absolute - degrees) * 60).toFixed(4);

  const direction = isLat
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
      ? "E"
      : "W";

  return `${degrees}° ${minutes}' ${direction}`;
}

/**
 * A control that displays the current cursor coordinates on the map.
 *
 * @example
 * ```typescript
 * const coordControl = new CoordinateControl({
 *   format: 'decimal',
 *   precision: 6,
 *   copyOnClick: true,
 *   showZoom: true,
 * });
 * map.addControl(coordControl, 'bottom-left');
 *
 * coordControl.on('copy', (event) => {
 *   console.log('Copied:', event.coordinates);
 * });
 * ```
 */
export class CoordinateControl implements IControl {
  private _container?: HTMLElement;
  private _options: Required<CoordinateControlOptions>;
  private _state: CoordinateControlState;
  private _eventHandlers: Map<CoordinateEvent, Set<CoordinateEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // DOM elements
  private _lngValueEl?: HTMLElement;
  private _latValueEl?: HTMLElement;
  private _zoomValueEl?: HTMLElement;
  private _feedbackEl?: HTMLElement;

  // Event handlers
  private _boundMoveHandler?: (e: MapMouseEvent) => void;
  private _boundLeaveHandler?: () => void;

  // Feedback timeout
  private _feedbackTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Creates a new CoordinateControl instance.
   */
  constructor(options?: CoordinateControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      format: this._options.format,
      lng: null,
      lat: null,
      elevation: null,
      zoom: null,
    };
  }

  /**
   * Called when the control is added to the map.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._setupEventHandlers();
    this._setupZoomHandler();

    // Initialize zoom value
    if (this._options.showZoom && this._zoomValueEl) {
      this._state.zoom = map.getZoom();
      this._zoomValueEl.textContent = this._state.zoom.toFixed(2);
    }

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    this._cleanupEventHandlers();

    if (this._handleZoom && this._map) {
      this._map.off("zoom", this._handleZoom);
    }

    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
    }

    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  /**
   * Get the default position for this control.
   */
  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  /**
   * Register an event handler.
   */
  on(event: CoordinateEvent, handler: CoordinateEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: CoordinateEvent, handler: CoordinateEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  /**
   * Emit an event to registered handlers.
   */
  private _emit(
    event: CoordinateEvent,
    extra?: { coordinates?: { lng: number; lat: number } },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = {
        type: event,
        state: { ...this._state },
        ...extra,
      };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Create the control container.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-coordinate-control ${this._options.className}`;

    if (this._options.copyOnClick) {
      container.classList.add("clickable");
      container.title = "Click to copy coordinates";
      container.addEventListener("click", () => this._copyCoordinates());
    }

    container.style.background = this._options.backgroundColor;
    container.style.borderRadius = `${this._options.borderRadius}px`;
    container.style.fontSize = `${this._options.fontSize}px`;
    container.style.color = this._options.fontColor;
    container.style.padding = `${this._options.padding}px ${this._options.padding + 4}px`;

    if (!this._state.visible) {
      container.style.display = "none";
    }

    // Create content
    const coordContainer = document.createElement("div");
    coordContainer.className = "coord-container";

    // Longitude
    const lngItem = document.createElement("span");
    lngItem.className = "coord-item";
    lngItem.innerHTML = `
      <span class="coord-label">${this._options.lngLabel}</span>
      <span class="coord-value lng-value">--</span>
    `;
    this._lngValueEl = lngItem.querySelector(".lng-value")!;
    coordContainer.appendChild(lngItem);

    // Separator
    const sep = document.createElement("span");
    sep.className = "coord-separator";
    sep.textContent = "|";
    coordContainer.appendChild(sep);

    // Latitude
    const latItem = document.createElement("span");
    latItem.className = "coord-item";
    latItem.innerHTML = `
      <span class="coord-label">${this._options.latLabel}</span>
      <span class="coord-value lat-value">--</span>
    `;
    this._latValueEl = latItem.querySelector(".lat-value")!;
    coordContainer.appendChild(latItem);

    // Zoom (optional)
    if (this._options.showZoom) {
      const zoomItem = document.createElement("span");
      zoomItem.className = "coord-item coord-zoom";
      zoomItem.innerHTML = `
        <span class="coord-label">Z</span>
        <span class="coord-value zoom-value">--</span>
      `;
      this._zoomValueEl = zoomItem.querySelector(".zoom-value")!;
      coordContainer.appendChild(zoomItem);
    }

    // Elevation (optional) - placeholder for future terrain integration
    if (this._options.showElevation) {
      const elevItem = document.createElement("span");
      elevItem.className = "coord-item coord-elevation";
      elevItem.innerHTML = `
        <span class="coord-label">Elev</span>
        <span class="coord-value elev-value">--</span>
        <span class="coord-label">m</span>
      `;
      coordContainer.appendChild(elevItem);
    }

    // Format toggle button
    const formatBtn = document.createElement("button");
    formatBtn.type = "button";
    formatBtn.className = "format-toggle";
    formatBtn.title = "Toggle coordinate format";
    formatBtn.textContent = FORMAT_LABELS[this._state.format];
    formatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleFormat();
      formatBtn.textContent = FORMAT_LABELS[this._state.format];
    });
    coordContainer.appendChild(formatBtn);

    // Feedback element (shown after copy)
    this._feedbackEl = document.createElement("span");
    this._feedbackEl.className = "copied-feedback";
    this._feedbackEl.innerHTML = `${CHECK_ICON} Copied`;
    this._feedbackEl.style.display = "none";
    coordContainer.appendChild(this._feedbackEl);

    container.appendChild(coordContainer);
    return container;
  }

  /**
   * Set up mouse event handlers.
   */
  private _setupEventHandlers(): void {
    if (!this._map) return;

    this._boundMoveHandler = (e: MapMouseEvent) => {
      this._state.lng = e.lngLat.lng;
      this._state.lat = e.lngLat.lat;
      this._updateDisplay();
      this._emit("update", {
        coordinates: { lng: e.lngLat.lng, lat: e.lngLat.lat },
      });
    };

    this._boundLeaveHandler = () => {
      this._state.lng = null;
      this._state.lat = null;
      if (this._lngValueEl) this._lngValueEl.textContent = "--";
      if (this._latValueEl) this._latValueEl.textContent = "--";
    };

    this._map.on("mousemove", this._boundMoveHandler);
    this._map.on("mouseout", this._boundLeaveHandler);

    // Update zoom display
    if (this._options.showZoom) {
      this._map.on("zoom", () => {
        if (this._map && this._zoomValueEl) {
          this._state.zoom = this._map.getZoom();
          this._zoomValueEl.textContent = this._state.zoom.toFixed(2);
        }
      });
    }
  }

  /**
   * Clean up event handlers.
   */
  private _cleanupEventHandlers(): void {
    if (!this._map) return;

    if (this._boundMoveHandler) {
      this._map.off("mousemove", this._boundMoveHandler);
    }
    if (this._boundLeaveHandler) {
      this._map.off("mouseout", this._boundLeaveHandler);
    }
  }

  /**
   * Update the coordinate display.
   */
  private _updateDisplay(): void {
    if (this._state.lng === null || this._state.lat === null) return;

    let lngStr: string;
    let latStr: string;

    switch (this._state.format) {
      case "dms":
        lngStr = decimalToDMS(this._state.lng, false);
        latStr = decimalToDMS(this._state.lat, true);
        break;
      case "ddm":
        lngStr = decimalToDDM(this._state.lng, false);
        latStr = decimalToDDM(this._state.lat, true);
        break;
      default:
        lngStr = this._state.lng.toFixed(this._options.precision);
        latStr = this._state.lat.toFixed(this._options.precision);
    }

    if (this._lngValueEl) this._lngValueEl.textContent = lngStr;
    if (this._latValueEl) this._latValueEl.textContent = latStr;
  }

  /**
   * Toggle the coordinate format.
   */
  private _toggleFormat(): void {
    const formats: CoordinateFormat[] = ["decimal", "dms", "ddm"];
    const currentIndex = formats.indexOf(this._state.format);
    this._state.format = formats[(currentIndex + 1) % formats.length];
    this._updateDisplay();
    this._emit("formatchange");
  }

  /**
   * Copy coordinates to clipboard.
   */
  private async _copyCoordinates(): Promise<void> {
    if (this._state.lng === null || this._state.lat === null) return;

    let text: string;

    switch (this._state.format) {
      case "dms":
        text = `${decimalToDMS(this._state.lat, true)}, ${decimalToDMS(this._state.lng, false)}`;
        break;
      case "ddm":
        text = `${decimalToDDM(this._state.lat, true)}, ${decimalToDDM(this._state.lng, false)}`;
        break;
      default:
        text = `${this._state.lat.toFixed(this._options.precision)}, ${this._state.lng.toFixed(this._options.precision)}`;
    }

    try {
      await navigator.clipboard.writeText(text);
      this._showCopyFeedback();
      this._emit("copy", {
        coordinates: { lng: this._state.lng, lat: this._state.lat },
      });
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      this._showCopyFeedback();
      this._emit("copy", {
        coordinates: { lng: this._state.lng, lat: this._state.lat },
      });
    }
  }

  /**
   * Show copy feedback.
   */
  private _showCopyFeedback(): void {
    if (!this._feedbackEl || !this._container) return;

    this._container.classList.add("copied");
    this._feedbackEl.style.display = "inline-flex";

    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
    }

    this._feedbackTimeout = setTimeout(() => {
      this._container?.classList.remove("copied");
      if (this._feedbackEl) this._feedbackEl.style.display = "none";
    }, 1500);
  }

  /**
   * Set up zoom-based visibility handling.
   */
  private _setupZoomHandler(): void {
    if (!this._map) return;

    this._handleZoom = () => {
      const zoom = this._map!.getZoom();
      const shouldShow =
        zoom >= this._options.minzoom && zoom <= this._options.maxzoom;

      if (shouldShow !== this._zoomVisible) {
        this._zoomVisible = shouldShow;
        if (this._container) {
          this._container.style.display =
            shouldShow && this._state.visible ? "" : "none";
        }
      }
    };

    this._map.on("zoom", this._handleZoom);
    this._handleZoom();
  }

  // Public API methods

  /**
   * Show the control.
   */
  show(): this {
    this._state.visible = true;
    if (this._container && this._zoomVisible) {
      this._container.style.display = "";
    }
    this._emit("show");
    return this;
  }

  /**
   * Hide the control.
   */
  hide(): this {
    this._state.visible = false;
    if (this._container) {
      this._container.style.display = "none";
    }
    this._emit("hide");
    return this;
  }

  /**
   * Get the current state.
   */
  getState(): CoordinateControlState {
    return { ...this._state };
  }

  /**
   * Get the current coordinates.
   */
  getCoordinates(): { lng: number; lat: number } | null {
    if (this._state.lng === null || this._state.lat === null) return null;
    return { lng: this._state.lng, lat: this._state.lat };
  }

  /**
   * Set the coordinate format.
   */
  setFormat(format: CoordinateFormat): this {
    this._state.format = format;
    this._updateDisplay();

    const formatBtn = this._container?.querySelector(".format-toggle");
    if (formatBtn) formatBtn.textContent = FORMAT_LABELS[format];

    this._emit("formatchange");
    return this;
  }

  /**
   * Set the precision for decimal format.
   */
  setPrecision(precision: number): this {
    this._options.precision = precision;
    this._updateDisplay();
    return this;
  }
}
