import "../styles/common.css";
import "../styles/measure-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  MapMouseEvent,
  GeoJSONSource,
  Marker,
  ControlPosition,
} from "maplibre-gl";
import type {
  MeasureControlOptions,
  MeasureControlState,
  MeasureEvent,
  MeasureEventHandler,
  MeasureMode,
  MeasurePoint,
  Measurement,
  DistanceUnit,
  AreaUnit,
} from "./types";
import { generateId } from "../utils/helpers";

/**
 * Default options for the MeasureControl.
 */
const DEFAULT_OPTIONS: Required<MeasureControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  defaultMode: "distance",
  distanceUnit: "kilometers",
  areaUnit: "square-kilometers",
  lineColor: "#3b82f6",
  lineWidth: 3,
  fillColor: "rgba(59, 130, 246, 0.2)",
  pointColor: "#ef4444",
  pointRadius: 6,
  showSegments: true,
  showTotal: true,
  precision: 2,
  panelWidth: 240,
  maxHeight: 500,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  fontSize: 12,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG icon for the measure button (ruler).
 */
const MEASURE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>`;

/**
 * SVG icon for distance mode.
 */
const DISTANCE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v4l-4 0"/><path d="M4 7l16 14"/><path d="M16 21v-4l4 0"/></svg>`;

/**
 * SVG icon for area mode.
 */
const AREA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

/**
 * SVG icon for close button.
 */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * SVG icon for trash/delete.
 */
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

/**
 * Distance unit labels and conversion factors (to meters).
 */
const DISTANCE_UNITS: Record<DistanceUnit, { label: string; factor: number }> =
  {
    meters: { label: "Meters", factor: 1 },
    kilometers: { label: "Kilometers", factor: 0.001 },
    miles: { label: "Miles", factor: 0.000621371 },
    feet: { label: "Feet", factor: 3.28084 },
    yards: { label: "Yards", factor: 1.09361 },
    "nautical-miles": { label: "Nautical Miles", factor: 0.000539957 },
  };

/**
 * Area unit labels and conversion factors (from square meters).
 */
const AREA_UNITS: Record<AreaUnit, { label: string; factor: number }> = {
  "square-meters": { label: "Square Meters", factor: 1 },
  "square-kilometers": { label: "Square Kilometers", factor: 0.000001 },
  "square-miles": { label: "Square Miles", factor: 3.861e-7 },
  hectares: { label: "Hectares", factor: 0.0001 },
  acres: { label: "Acres", factor: 0.000247105 },
  "square-feet": { label: "Square Feet", factor: 10.7639 },
};

/**
 * Calculate the distance between two points using the Haversine formula.
 */
function haversineDistance(p1: MeasurePoint, p2: MeasurePoint): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the area of a polygon using the Shoelace formula (spherical approximation).
 */
function calculatePolygonArea(points: MeasurePoint[]): number {
  if (points.length < 3) return 0;

  const R = 6371000; // Earth's radius in meters
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const lat1 = (points[i].lat * Math.PI) / 180;
    const lat2 = (points[j].lat * Math.PI) / 180;
    const lng1 = (points[i].lng * Math.PI) / 180;
    const lng2 = (points[j].lng * Math.PI) / 180;

    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 2);
  return area;
}

/**
 * A control for measuring distances and areas on the map.
 *
 * @example
 * ```typescript
 * const measureControl = new MeasureControl({
 *   defaultMode: 'distance',
 *   distanceUnit: 'kilometers',
 * });
 * map.addControl(measureControl, 'top-right');
 *
 * measureControl.on('drawend', (event) => {
 *   console.log('Measurement:', event.measurement);
 * });
 * ```
 */
export class MeasureControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<MeasureControlOptions>;
  private _state: MeasureControlState;
  private _eventHandlers: Map<MeasureEvent, Set<MeasureEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // Source and layer IDs
  private _sourceId: string;
  private _lineLayerId: string;
  private _fillLayerId: string;

  // DOM elements
  private _resultValueEl?: HTMLElement;
  private _resultUnitEl?: HTMLElement;
  private _segmentListEl?: HTMLElement;
  private _instructionsEl?: HTMLElement;
  private _measurementsListEl?: HTMLElement;

  // Event handlers
  private _boundClickHandler?: (e: MapMouseEvent) => void;
  private _boundMoveHandler?: (e: MapMouseEvent) => void;
  private _boundDblClickHandler?: (e: MapMouseEvent) => void;
  private _boundKeyHandler?: (e: KeyboardEvent) => void;

  // Markers for vertices
  private _markers: Marker[] = [];

  /**
   * Creates a new MeasureControl instance.
   */
  constructor(options?: MeasureControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      mode: this._options.defaultMode,
      distanceUnit: this._options.distanceUnit,
      areaUnit: this._options.areaUnit,
      isDrawing: false,
      currentPoints: [],
      currentValue: 0,
      currentSegments: [],
      measurements: [],
    };

    const uid = generateId("measure");
    this._sourceId = `${uid}-source`;
    this._lineLayerId = `${uid}-line`;
    this._fillLayerId = `${uid}-fill`;
  }

  /**
   * Called when the control is added to the map.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    if (map.isStyleLoaded()) {
      this._setupMapSources();
    } else {
      map.once("styledata", () => this._setupMapSources());
    }
    this._setupZoomHandler();

    if (!this._state.collapsed) {
      this._showPanel();
    }

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    this._stopDrawing();
    this._cleanupMapSources();
    this._clearMarkers();

    if (this._handleZoom && this._map) {
      this._map.off("zoom", this._handleZoom);
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
  on(event: MeasureEvent, handler: MeasureEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: MeasureEvent, handler: MeasureEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  /**
   * Emit an event to registered handlers.
   */
  private _emit(
    event: MeasureEvent,
    extra?: Partial<{ measurement: Measurement }>,
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
    container.className = `maplibregl-ctrl maplibre-gl-measure-control ${this._options.className}`;
    container.style.opacity = String(this._options.opacity);

    if (!this._state.visible) {
      container.style.display = "none";
    }

    // Main button
    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "measure-button";
    this._button.title = "Measure distances and areas";
    this._button.innerHTML = MEASURE_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  /**
   * Create the panel content.
   */
  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `measure-panel ${this._options.position.includes("left") ? "right" : "left"}`;
    panel.style.width = `${this._options.panelWidth}px`;
    if (this._options.maxHeight && this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }
    panel.style.background = this._options.backgroundColor;
    panel.style.borderRadius = `${this._options.borderRadius}px`;
    panel.style.fontSize = `${this._options.fontSize}px`;
    panel.style.color = this._options.fontColor;

    // Header
    const header = document.createElement("div");
    header.className = "measure-header";
    header.innerHTML = `
      <span>Measure</span>
      <button type="button" class="measure-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".measure-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "measure-content";

    // Mode toggle
    const modeToggle = document.createElement("div");
    modeToggle.className = "measure-mode-toggle";
    modeToggle.innerHTML = `
      <button type="button" class="mode-btn ${this._state.mode === "distance" ? "active" : ""}" data-mode="distance">
        ${DISTANCE_ICON}
        <span>Distance</span>
      </button>
      <button type="button" class="mode-btn ${this._state.mode === "area" ? "active" : ""}" data-mode="area">
        ${AREA_ICON}
        <span>Area</span>
      </button>
    `;
    modeToggle.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset
          .mode as MeasureMode;
        this._setMode(mode);
      });
    });
    content.appendChild(modeToggle);

    // Unit selector
    const unitDiv = document.createElement("div");
    unitDiv.className = "measure-unit";
    unitDiv.innerHTML = `
      <label>Unit</label>
      <select></select>
    `;
    const select = unitDiv.querySelector("select")!;
    select.style.color = "#000";
    this._updateUnitOptions(select);
    select.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      if (this._state.mode === "distance") {
        this._state.distanceUnit = value as DistanceUnit;
      } else {
        this._state.areaUnit = value as AreaUnit;
      }
      this._updateResult();
      this._emit("unitchange");
    });
    content.appendChild(unitDiv);

    // Result display
    const resultDiv = document.createElement("div");
    resultDiv.className = "measure-result";
    resultDiv.style.display = "none";
    resultDiv.innerHTML = `
      <div class="result-label">${this._state.mode === "distance" ? "Total Distance" : "Total Area"}</div>
      <div>
        <span class="result-value">0</span>
        <span class="result-unit">${this._getCurrentUnitLabel()}</span>
      </div>
      <div class="measure-segments" style="display: none;">
        <div class="segment-label">Segments</div>
        <div class="segment-list"></div>
      </div>
    `;
    this._resultValueEl = resultDiv.querySelector(".result-value")!;
    this._resultUnitEl = resultDiv.querySelector(".result-unit")!;
    this._segmentListEl = resultDiv.querySelector(".segment-list")!;
    content.appendChild(resultDiv);

    // Instructions
    this._instructionsEl = document.createElement("div");
    this._instructionsEl.className = "measure-instructions";
    this._instructionsEl.textContent =
      "Click on the map to start measuring. Double-click to finish.";
    content.appendChild(this._instructionsEl);

    // Measurements list
    this._measurementsListEl = document.createElement("div");
    this._measurementsListEl.className = "measurements-list";
    this._measurementsListEl.style.display = "none";
    content.appendChild(this._measurementsListEl);

    // Actions
    const actions = document.createElement("div");
    actions.className = "measure-actions";
    actions.innerHTML = `
      <button type="button" class="action-btn primary start-btn">
        ${MEASURE_ICON}
        <span>Start</span>
      </button>
      <button type="button" class="action-btn danger clear-btn" disabled>
        ${TRASH_ICON}
        <span>Clear All</span>
      </button>
    `;
    actions.querySelector(".start-btn")?.addEventListener("click", () => {
      if (this._state.isDrawing) {
        this._finishDrawing();
      } else {
        this._startDrawing();
      }
    });
    actions
      .querySelector(".clear-btn")
      ?.addEventListener("click", () => this._clearAll());
    content.appendChild(actions);

    panel.appendChild(content);
    return panel;
  }

  /**
   * Update unit dropdown options based on current mode.
   */
  private _updateUnitOptions(select: HTMLSelectElement): void {
    select.innerHTML = "";
    const units = this._state.mode === "distance" ? DISTANCE_UNITS : AREA_UNITS;
    const currentUnit =
      this._state.mode === "distance"
        ? this._state.distanceUnit
        : this._state.areaUnit;

    Object.entries(units).forEach(([key, { label }]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      option.selected = key === currentUnit;
      select.appendChild(option);
    });
  }

  /**
   * Get the current unit label.
   */
  private _getCurrentUnitLabel(): string {
    if (this._state.mode === "distance") {
      return DISTANCE_UNITS[this._state.distanceUnit].label;
    }
    return AREA_UNITS[this._state.areaUnit].label;
  }

  /**
   * Expand the panel.
   */
  expand(): void {
    if (!this._state.collapsed) return;
    this._state.collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  /**
   * Collapse the panel.
   */
  collapse(): void {
    if (this._state.collapsed) return;
    this._state.collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  /**
   * Toggle the panel visibility.
   */
  private _togglePanel(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Show the panel.
   */
  private _showPanel(): void {
    if (!this._panel && this._container) {
      this._panel = this._createPanel();
      this._container.appendChild(this._panel);
    }
    this._button?.classList.add("active");
  }

  /**
   * Hide the panel.
   */
  private _hidePanel(): void {
    this._stopDrawing();
    this._panel?.remove();
    this._panel = undefined;
    this._button?.classList.remove("active");
  }

  /**
   * Set the measurement mode.
   */
  private _setMode(mode: MeasureMode): void {
    if (mode === this._state.mode) return;

    this._stopDrawing();
    this._state.mode = mode;

    // Update UI
    this._panel?.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn as HTMLElement).dataset.mode === mode,
      );
    });

    const select = this._panel?.querySelector(
      ".measure-unit select",
    ) as HTMLSelectElement;
    if (select) {
      this._updateUnitOptions(select);
    }

    const resultLabel = this._panel?.querySelector(".result-label");
    if (resultLabel) {
      resultLabel.textContent =
        mode === "distance" ? "Total Distance" : "Total Area";
    }

    this._emit("modechange");
  }

  /**
   * Set up map sources and layers for rendering measurements.
   */
  private _setupMapSources(): void {
    if (!this._map) return;

    // Add source
    this._map.addSource(this._sourceId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Add fill layer for polygons
    this._map.addLayer({
      id: this._fillLayerId,
      type: "fill",
      source: this._sourceId,
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": this._options.fillColor,
      },
    });

    // Add line layer
    this._map.addLayer({
      id: this._lineLayerId,
      type: "line",
      source: this._sourceId,
      paint: {
        "line-color": this._options.lineColor,
        "line-width": this._options.lineWidth,
      },
    });
  }

  /**
   * Clean up map sources and layers.
   */
  private _cleanupMapSources(): void {
    if (!this._map) return;

    if (this._map.getLayer(this._lineLayerId)) {
      this._map.removeLayer(this._lineLayerId);
    }
    if (this._map.getLayer(this._fillLayerId)) {
      this._map.removeLayer(this._fillLayerId);
    }
    if (this._map.getSource(this._sourceId)) {
      this._map.removeSource(this._sourceId);
    }
  }

  /**
   * Start drawing a measurement.
   */
  private _startDrawing(): void {
    if (!this._map || this._state.isDrawing) return;

    this._state.isDrawing = true;
    this._state.currentPoints = [];
    this._state.currentValue = 0;
    this._state.currentSegments = [];

    // Update button text
    const startBtn = this._panel?.querySelector(".start-btn span");
    if (startBtn) startBtn.textContent = "Finish";

    // Show result area
    const resultDiv = this._panel?.querySelector(
      ".measure-result",
    ) as HTMLElement;
    if (resultDiv) resultDiv.style.display = "block";

    // Update instructions
    if (this._instructionsEl) {
      this._instructionsEl.textContent =
        this._state.mode === "distance"
          ? "Click to add points. Double-click or press Enter to finish."
          : "Click to add vertices. Double-click or press Enter to close the polygon.";
    }

    // Set up event handlers
    this._boundClickHandler = (e: MapMouseEvent) => this._handleClick(e);
    this._boundMoveHandler = (e: MapMouseEvent) => this._handleMouseMove(e);
    this._boundDblClickHandler = (e: MapMouseEvent) => {
      e.preventDefault();
      this._finishDrawing();
    };
    this._boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this._finishDrawing();
      } else if (e.key === "Escape") {
        this._cancelDrawing();
      }
    };

    this._map.on("click", this._boundClickHandler);
    this._map.on("mousemove", this._boundMoveHandler);
    this._map.on("dblclick", this._boundDblClickHandler);
    document.addEventListener("keydown", this._boundKeyHandler);

    // Change cursor
    this._map.getCanvas().style.cursor = "crosshair";

    this._emit("drawstart");
  }

  /**
   * Stop drawing (cleanup event handlers).
   */
  private _stopDrawing(): void {
    if (!this._map) return;

    if (this._boundClickHandler) {
      this._map.off("click", this._boundClickHandler);
    }
    if (this._boundMoveHandler) {
      this._map.off("mousemove", this._boundMoveHandler);
    }
    if (this._boundDblClickHandler) {
      this._map.off("dblclick", this._boundDblClickHandler);
    }
    if (this._boundKeyHandler) {
      document.removeEventListener("keydown", this._boundKeyHandler);
    }

    this._map.getCanvas().style.cursor = "";
    this._state.isDrawing = false;

    // Update button text
    const startBtn = this._panel?.querySelector(".start-btn span");
    if (startBtn) startBtn.textContent = "Start";
  }

  /**
   * Handle map click during drawing.
   */
  private _handleClick(e: MapMouseEvent): void {
    const point: MeasurePoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    this._state.currentPoints.push(point);

    // Add marker for vertex
    this._addMarker(point);

    // Update measurement
    this._updateMeasurement();
    this._updateMapGeometry();
    this._emit("drawupdate");
  }

  /**
   * Handle mouse move during drawing.
   */
  private _handleMouseMove(e: MapMouseEvent): void {
    if (this._state.currentPoints.length === 0) return;

    // Create temporary geometry including mouse position
    const tempPoints = [
      ...this._state.currentPoints,
      { lng: e.lngLat.lng, lat: e.lngLat.lat },
    ];
    this._updateMapGeometry(tempPoints);
  }

  /**
   * Finish the current drawing.
   */
  private _finishDrawing(): void {
    if (this._state.currentPoints.length < 2) {
      this._cancelDrawing();
      return;
    }

    if (this._state.mode === "area" && this._state.currentPoints.length < 3) {
      this._cancelDrawing();
      return;
    }

    // Create measurement
    const measurement: Measurement = {
      id: generateId("measurement"),
      mode: this._state.mode,
      points: [...this._state.currentPoints],
      segments: [...this._state.currentSegments],
    };

    if (this._state.mode === "distance") {
      measurement.distance = this._state.currentValue;
    } else {
      measurement.area = this._state.currentValue;
    }

    this._state.measurements.push(measurement);
    this._stopDrawing();
    this._updateMapGeometry();
    this._updateMeasurementsList();

    // Enable clear button
    const clearBtn = this._panel?.querySelector(
      ".clear-btn",
    ) as HTMLButtonElement;
    if (clearBtn) clearBtn.disabled = false;

    this._emit("drawend", { measurement });
    this._emit("measurementadd", { measurement });
  }

  /**
   * Cancel the current drawing.
   */
  private _cancelDrawing(): void {
    this._stopDrawing();
    this._clearMarkers();
    this._state.currentPoints = [];
    this._state.currentValue = 0;
    this._state.currentSegments = [];
    this._updateMapGeometry();

    // Hide result
    const resultDiv = this._panel?.querySelector(
      ".measure-result",
    ) as HTMLElement;
    if (resultDiv) resultDiv.style.display = "none";

    // Reset instructions
    if (this._instructionsEl) {
      this._instructionsEl.textContent =
        "Click on the map to start measuring. Double-click to finish.";
    }
  }

  /**
   * Update the current measurement calculation.
   */
  private _updateMeasurement(): void {
    const points = this._state.currentPoints;

    if (this._state.mode === "distance") {
      // Calculate total distance and segments
      let total = 0;
      const segments: number[] = [];

      for (let i = 1; i < points.length; i++) {
        const dist = haversineDistance(points[i - 1], points[i]);
        segments.push(dist);
        total += dist;
      }

      this._state.currentValue = total;
      this._state.currentSegments = segments;
    } else {
      // Calculate area
      this._state.currentValue = calculatePolygonArea(points);
    }

    this._updateResult();
  }

  /**
   * Update the result display.
   */
  private _updateResult(): void {
    if (!this._resultValueEl || !this._resultUnitEl) return;

    let displayValue: number;
    let unitLabel: string;

    if (this._state.mode === "distance") {
      const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
      displayValue = this._state.currentValue * factor;
      unitLabel = DISTANCE_UNITS[this._state.distanceUnit].label;
    } else {
      const factor = AREA_UNITS[this._state.areaUnit].factor;
      displayValue = this._state.currentValue * factor;
      unitLabel = AREA_UNITS[this._state.areaUnit].label;
    }

    this._resultValueEl.textContent = displayValue.toFixed(
      this._options.precision,
    );
    this._resultUnitEl.textContent = unitLabel;

    // Update segments display
    if (
      this._segmentListEl &&
      this._state.mode === "distance" &&
      this._options.showSegments
    ) {
      const segmentsContainer = this._segmentListEl
        .parentElement as HTMLElement;
      if (this._state.currentSegments.length > 0) {
        segmentsContainer.style.display = "block";
        const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
        this._segmentListEl.innerHTML = this._state.currentSegments
          .map(
            (seg, i) =>
              `<span class="segment-item">${i + 1}: ${(seg * factor).toFixed(2)}</span>`,
          )
          .join("");
      } else {
        segmentsContainer.style.display = "none";
      }
    }
  }

  /**
   * Update the map geometry (lines/polygons).
   */
  private _updateMapGeometry(tempPoints?: MeasurePoint[]): void {
    if (!this._map) return;

    const source = this._map.getSource(this._sourceId) as GeoJSONSource;
    if (!source) return;

    const features: GeoJSON.Feature[] = [];

    // Add completed measurements
    for (const m of this._state.measurements) {
      if (m.mode === "distance") {
        features.push({
          type: "Feature",
          properties: { id: m.id, mode: m.mode },
          geometry: {
            type: "LineString",
            coordinates: m.points.map((p) => [p.lng, p.lat]),
          },
        });
      } else {
        const coords = m.points.map((p) => [p.lng, p.lat]);
        coords.push(coords[0]); // Close the polygon
        features.push({
          type: "Feature",
          properties: { id: m.id, mode: m.mode },
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
        });
      }
    }

    // Add current drawing
    const drawPoints = tempPoints || this._state.currentPoints;
    if (drawPoints.length >= 2) {
      if (this._state.mode === "distance") {
        features.push({
          type: "Feature",
          properties: { current: true },
          geometry: {
            type: "LineString",
            coordinates: drawPoints.map((p) => [p.lng, p.lat]),
          },
        });
      } else if (drawPoints.length >= 3) {
        const coords = drawPoints.map((p) => [p.lng, p.lat]);
        coords.push(coords[0]);
        features.push({
          type: "Feature",
          properties: { current: true },
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
        });
      } else {
        // Just a line for < 3 points in area mode
        features.push({
          type: "Feature",
          properties: { current: true },
          geometry: {
            type: "LineString",
            coordinates: drawPoints.map((p) => [p.lng, p.lat]),
          },
        });
      }
    }

    source.setData({ type: "FeatureCollection", features });
  }

  /**
   * Add a marker for a vertex.
   */
  private _addMarker(point: MeasurePoint): void {
    if (!this._map) return;

    // Use dynamically imported maplibre-gl or fallback to window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maplibreglModule = (window as any).maplibregl;
    // Also try dynamic import
    import("maplibre-gl").then((mod) => {
      const MaplibreMarker = mod.Marker || maplibreglModule?.Marker;
      if (!MaplibreMarker || !this._map) return;

      const el = document.createElement("div");
      el.className = "maplibre-gl-measure-vertex";
      el.style.width = `${this._options.pointRadius * 2}px`;
      el.style.height = `${this._options.pointRadius * 2}px`;
      el.style.borderRadius = "50%";
      el.style.backgroundColor = this._options.pointColor;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      const marker = new MaplibreMarker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(this._map);

      this._markers.push(marker);
    });
  }

  /**
   * Clear all markers.
   */
  private _clearMarkers(): void {
    this._markers.forEach((m) => m.remove());
    this._markers = [];
  }

  /**
   * Update the measurements list display.
   */
  private _updateMeasurementsList(): void {
    if (!this._measurementsListEl) return;

    if (this._state.measurements.length === 0) {
      this._measurementsListEl.style.display = "none";
      return;
    }

    this._measurementsListEl.style.display = "block";
    this._measurementsListEl.innerHTML = this._state.measurements
      .map((m) => {
        let value: string;
        let icon: string;

        if (m.mode === "distance") {
          const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
          value = `${((m.distance || 0) * factor).toFixed(2)} ${DISTANCE_UNITS[this._state.distanceUnit].label}`;
          icon = DISTANCE_ICON;
        } else {
          const factor = AREA_UNITS[this._state.areaUnit].factor;
          value = `${((m.area || 0) * factor).toFixed(2)} ${AREA_UNITS[this._state.areaUnit].label}`;
          icon = AREA_ICON;
        }

        return `
          <div class="measurement-item" data-id="${m.id}">
            <div class="measurement-info">
              <span class="measurement-icon">${icon}</span>
              <span class="measurement-value">${value}</span>
            </div>
            <button type="button" class="measurement-delete" title="Delete">${CLOSE_ICON}</button>
          </div>
        `;
      })
      .join("");

    // Add delete handlers
    this._measurementsListEl
      .querySelectorAll(".measurement-delete")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const item = (e.currentTarget as HTMLElement).closest(
            ".measurement-item",
          ) as HTMLElement;
          const id = item?.dataset.id;
          if (id) this._removeMeasurement(id);
        });
      });
  }

  /**
   * Remove a measurement by ID.
   */
  private _removeMeasurement(id: string): void {
    const index = this._state.measurements.findIndex((m) => m.id === id);
    if (index === -1) return;

    const measurement = this._state.measurements[index];
    this._state.measurements.splice(index, 1);
    this._updateMapGeometry();
    this._updateMeasurementsList();

    // Disable clear button if no measurements
    if (this._state.measurements.length === 0) {
      const clearBtn = this._panel?.querySelector(
        ".clear-btn",
      ) as HTMLButtonElement;
      if (clearBtn) clearBtn.disabled = true;
    }

    this._emit("measurementremove", { measurement });
  }

  /**
   * Clear all measurements.
   */
  private _clearAll(): void {
    this._cancelDrawing();
    this._state.measurements = [];
    this._clearMarkers();
    this._updateMapGeometry();
    this._updateMeasurementsList();

    // Hide result
    const resultDiv = this._panel?.querySelector(
      ".measure-result",
    ) as HTMLElement;
    if (resultDiv) resultDiv.style.display = "none";

    // Disable clear button
    const clearBtn = this._panel?.querySelector(
      ".clear-btn",
    ) as HTMLButtonElement;
    if (clearBtn) clearBtn.disabled = true;

    this._emit("clear");
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
  getState(): MeasureControlState {
    return { ...this._state };
  }

  /**
   * Get all measurements.
   */
  getMeasurements(): Measurement[] {
    return [...this._state.measurements];
  }

  /**
   * Set the measurement mode.
   */
  setMode(mode: MeasureMode): this {
    this._setMode(mode);
    return this;
  }

  /**
   * Set the distance unit.
   */
  setDistanceUnit(unit: DistanceUnit): this {
    this._state.distanceUnit = unit;
    this._updateResult();
    this._updateMeasurementsList();
    this._emit("unitchange");
    return this;
  }

  /**
   * Set the area unit.
   */
  setAreaUnit(unit: AreaUnit): this {
    this._state.areaUnit = unit;
    this._updateResult();
    this._updateMeasurementsList();
    this._emit("unitchange");
    return this;
  }

  /**
   * Clear all measurements.
   */
  clear(): this {
    this._clearAll();
    return this;
  }
}
