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
 * Mean radius of the Earth in meters, the default body the control measures on.
 *
 * Distances and areas are derived from lon/lat angles, so the only thing that
 * ties a measurement to a particular planet is the radius those angles are
 * multiplied by. Override it with the `radius` option (or {@link
 * MeasureControl.setRadius}) to measure on another body — 3389500 for Mars,
 * 1737400 for the Moon, and so on.
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Whether a radius can actually be measured against. A zero or negative radius
 * collapses every measurement to zero or flips its sign, and a non-finite one
 * makes every readout `NaN`, so both the constructor and {@link
 * MeasureControl.setRadius} fall back to Earth rather than accept one.
 */
function isUsableRadius(radius: unknown): radius is number {
  return typeof radius === "number" && Number.isFinite(radius) && radius > 0;
}

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
  backgroundColor: "",
  borderRadius: 4,
  opacity: 1,
  fontSize: 12,
  fontColor: "",
  minzoom: 0,
  maxzoom: 24,
  radius: EARTH_RADIUS_METERS,
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

const CIRCLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;

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
 *
 * @param radius Radius of the body in meters. Defaults to Earth's.
 */
function haversineDistance(
  p1: MeasurePoint,
  p2: MeasurePoint,
  radius: number = EARTH_RADIUS_METERS,
): number {
  const R = radius;
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
 *
 * @param radius Radius of the body in meters. Defaults to Earth's.
 */
function calculatePolygonArea(
  points: MeasurePoint[],
  radius: number = EARTH_RADIUS_METERS,
): number {
  if (points.length < 3) return 0;

  const R = radius;
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

/** Initial great-circle bearing, clockwise from true north. */
export function bearingBetween(p1: MeasurePoint, p2: MeasurePoint): number {
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Destination reached from a point by following a great-circle bearing. */
export function destinationPoint(
  start: MeasurePoint,
  distanceMeters: number,
  bearingDegrees: number,
  radius = EARTH_RADIUS_METERS,
): MeasurePoint {
  const angular = distanceMeters / radius;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lng1 = (start.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
    lat: (lat2 * 180) / Math.PI,
  };
}

function circlePoints(
  center: MeasurePoint,
  radiusMeters: number,
  radius: number,
): MeasurePoint[] {
  return Array.from({ length: 64 }, (_, index) =>
    destinationPoint(center, radiusMeters, (index * 360) / 64, radius),
  );
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
  private _livePreviewEl?: HTMLElement;

  // Event handlers
  private _boundClickHandler?: (e: MapMouseEvent) => void;
  private _boundMoveHandler?: (e: MapMouseEvent) => void;
  private _boundDblClickHandler?: (e: MapMouseEvent) => void;
  private _boundContextMenuHandler?: (e: MapMouseEvent) => void;
  private _boundKeyHandler?: (e: KeyboardEvent) => void;

  // Markers for vertices
  private _markers: Marker[] = [];

  /**
   * Creates a new MeasureControl instance.
   */
  constructor(options?: MeasureControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    // Normalize up front so an unusable radius cannot reach the maths;
    // setRadius applies the same rule to every later change.
    if (!isUsableRadius(this._options.radius)) {
      this._options.radius = EARTH_RADIUS_METERS;
    }
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
    this._removeLivePreview();

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
    this._button.title = "Measure distances, areas, and circles";
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
    // Only force colors when explicitly provided; otherwise the CSS custom
    // properties drive them so the panel adapts to the system theme.
    if (this._options.backgroundColor) {
      panel.style.background = this._options.backgroundColor;
    }
    panel.style.borderRadius = `${this._options.borderRadius}px`;
    panel.style.fontSize = `${this._options.fontSize}px`;
    if (this._options.fontColor) {
      panel.style.color = this._options.fontColor;
    }

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
      <button type="button" class="mode-btn ${this._state.mode === "circle" ? "active" : ""}" data-mode="circle">
        ${CIRCLE_ICON}
        <span>Circle</span>
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
    select.style.color = "var(--ms-input-text)";
    this._updateUnitOptions(select);
    select.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      // Go through the public setters so the saved measurements list is
      // re-rendered in the new unit too, not just the total readout.
      if (this._state.mode !== "area") {
        this.setDistanceUnit(value as DistanceUnit);
      } else {
        this.setAreaUnit(value as AreaUnit);
      }
    });
    content.appendChild(unitDiv);

    const precision = document.createElement("form");
    precision.className = "measure-precision";
    precision.style.display =
      this._state.mode === "distance" ? "block" : "none";
    precision.innerHTML = `
      <label>Exact segment</label>
      <div class="precision-row">
        <input class="precision-length" type="number" min="0" step="any" placeholder="Length" aria-label="Exact segment length">
        <input class="precision-bearing" type="number" step="any" placeholder="Bearing °" aria-label="Exact segment bearing">
        <button type="submit" title="Add exact segment">Add</button>
      </div>
    `;
    precision.addEventListener("submit", (event) => {
      event.preventDefault();
      this._addExactSegment();
    });
    content.appendChild(precision);

    // Result display
    const resultDiv = document.createElement("div");
    resultDiv.className = "measure-result";
    resultDiv.style.display = "none";
    resultDiv.innerHTML = `
      <div class="result-label">${this._resultLabel()}</div>
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
      "Click the map to add points. Double-click or right-click to finish.";
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
    const units = this._state.mode === "area" ? AREA_UNITS : DISTANCE_UNITS;
    const currentUnit =
      this._state.mode === "area"
        ? this._state.areaUnit
        : this._state.distanceUnit;

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
    if (this._state.mode !== "area") {
      return DISTANCE_UNITS[this._state.distanceUnit].label;
    }
    return AREA_UNITS[this._state.areaUnit].label;
  }

  private _resultLabel(): string {
    if (this._state.mode === "distance") return "Total Distance";
    if (this._state.mode === "circle") return "Radius";
    return "Total Area";
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

    // Opening the tool puts the map straight into drawing mode so the user can
    // click the map immediately, without first pressing a separate "Start"
    // button.
    if (!this._state.isDrawing) {
      this._startDrawing();
    }
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
    const changed = mode !== this._state.mode;
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
    const precision = this._panel?.querySelector(
      ".measure-precision",
    ) as HTMLElement | null;
    if (precision)
      precision.style.display = mode === "distance" ? "block" : "none";

    const resultLabel = this._panel?.querySelector(".result-label");
    if (resultLabel) {
      resultLabel.textContent = this._resultLabel();
    }

    if (changed) this._emit("modechange");

    // Selecting a mode immediately starts measuring. If a drawing is already in
    // progress, keep the points already placed and just re-interpret them under
    // the new mode (open polyline for distance, closed polygon for area) so the
    // user does not lose work when toggling mid-session.
    if (!this._panel) return;
    if (this._state.isDrawing) {
      this._updateMeasurement();
      this._updateMapGeometry();
    } else {
      this._startDrawing();
    }
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

    // Show the result area and refresh it. The in-progress value restarts at
    // zero, but the readout still carries the completed measurements' total.
    const resultDiv = this._panel?.querySelector(
      ".measure-result",
    ) as HTMLElement;
    if (resultDiv) resultDiv.style.display = "block";
    this._updateResult();

    // Update instructions
    if (this._instructionsEl) {
      this._instructionsEl.textContent =
        this._state.mode === "distance"
          ? "Click to add points. Double-click, right-click, or Enter to finish."
          : this._state.mode === "circle"
            ? "Click a center, then click the edge. Drag either point to refine it."
            : "Click to add vertices. Double-click, right-click, or Enter to close the polygon.";
    }

    // Set up event handlers
    this._boundClickHandler = (e: MapMouseEvent) => this._handleClick(e);
    this._boundMoveHandler = (e: MapMouseEvent) => this._handleMouseMove(e);
    this._boundDblClickHandler = (e: MapMouseEvent) => {
      e.preventDefault();
      this._finishOnDoubleClick();
    };
    // Right-click is a familiar "finish placing points" gesture in desktop GIS
    // tools (e.g. QGIS); support it here and suppress the browser context menu.
    this._boundContextMenuHandler = (e: MapMouseEvent) => {
      e.preventDefault();
      this._finishDrawing();
    };
    this._boundKeyHandler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Enter") {
        this._finishDrawing();
      } else if (e.key === "Escape") {
        this._cancelDrawing();
      }
    };

    this._map.on("click", this._boundClickHandler);
    this._map.on("mousemove", this._boundMoveHandler);
    this._map.on("dblclick", this._boundDblClickHandler);
    this._map.on("contextmenu", this._boundContextMenuHandler);
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
    if (this._boundContextMenuHandler) {
      this._map.off("contextmenu", this._boundContextMenuHandler);
    }
    if (this._boundKeyHandler) {
      document.removeEventListener("keydown", this._boundKeyHandler);
    }

    this._map.getCanvas().style.cursor = "";
    this._state.isDrawing = false;
    this._removeLivePreview();

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

    // A circle is completely defined by its center and one edge point.
    if (
      this._state.mode === "circle" &&
      this._state.currentPoints.length === 2
    ) {
      this._finishDrawing();
    }
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
    this._updateLivePreview(tempPoints, e);
  }

  /**
   * Finish the current drawing.
   */
  private _finishDrawing(): void {
    // A line needs at least two points; a polygon needs at least three. If the
    // user triggers "finish" too early (e.g. a stray double-click), ignore it
    // and keep the current drawing active instead of discarding their points.
    const required = this._state.mode === "area" ? 3 : 2;
    if (this._state.currentPoints.length < required) {
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
    } else if (this._state.mode === "circle") {
      measurement.radius = this._state.currentValue;
      measurement.area = Math.PI * this._state.currentValue ** 2;
    } else {
      measurement.area = this._state.currentValue;
    }

    this._state.measurements.push(measurement);
    this._stopDrawing();
    this._removeLivePreview();
    this._updateMapGeometry();
    this._updateMeasurementsList();

    // Enable clear button
    const clearBtn = this._panel?.querySelector(
      ".clear-btn",
    ) as HTMLButtonElement;
    if (clearBtn) clearBtn.disabled = false;

    this._emit("drawend", { measurement });
    this._emit("measurementadd", { measurement });

    // Re-arm immediately so the user can start the next measurement without
    // having to click "Start" again, matching the continuous workflow of a
    // typical desktop GIS measure tool.
    if (this._panel) {
      this._startDrawing();
    }
  }

  /**
   * Finish drawing from a double-click.
   *
   * A double-click emits two `click` events at (essentially) the same location
   * before this handler runs, so the final vertex gets added twice and the last
   * segment reads as zero length. Detect that duplicate in screen space (so it
   * works at any zoom level) and drop it before completing the measurement.
   */
  private _finishOnDoubleClick(): void {
    const points = this._state.currentPoints;
    if (this._map && points.length >= 2) {
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      const lastPx = this._map.project([last.lng, last.lat]);
      const prevPx = this._map.project([prev.lng, prev.lat]);
      if (Math.hypot(lastPx.x - prevPx.x, lastPx.y - prevPx.y) < 6) {
        points.pop();
        this._updateMeasurement();
      }
    }
    this._finishDrawing();
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
    this._removeLivePreview();

    // Keep the total on screen while completed measurements remain; only an
    // empty tool has nothing to report. Test for a saved measurement rather
    // than a non-zero total, since coincident points and degenerate polygons
    // are saved with a legitimately zero value.
    this._updateResult();
    const resultDiv = this._panel?.querySelector(
      ".measure-result",
    ) as HTMLElement;
    if (resultDiv) {
      const hasCompleted = this._state.measurements.some(
        (m) => m.mode === this._state.mode,
      );
      resultDiv.style.display = hasCompleted ? "block" : "none";
    }

    // Reset instructions
    if (this._instructionsEl) {
      this._instructionsEl.textContent =
        "Click the map to add points. Double-click or right-click to finish.";
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
        const dist = haversineDistance(
          points[i - 1],
          points[i],
          this._options.radius,
        );
        segments.push(dist);
        total += dist;
      }

      this._state.currentValue = total;
      this._state.currentSegments = segments;
    } else if (this._state.mode === "circle") {
      this._state.currentValue =
        points.length >= 2
          ? haversineDistance(points[0], points[1], this._options.radius)
          : 0;
      this._state.currentSegments = [];
    } else {
      // Calculate area
      this._state.currentValue = calculatePolygonArea(
        points,
        this._options.radius,
      );
    }

    this._updateResult();
  }

  /**
   * Total value for the active mode, in base units (meters or square meters).
   *
   * The readout is labelled "Total Distance" / "Total Area", so it sums every
   * completed measurement of the current mode plus the one being drawn. Without
   * the completed measurements it would drop back to zero the moment a drawing
   * finishes and the tool re-arms, even though the results are still listed.
   */
  private _totalValue(): number {
    const completed = this._state.measurements.reduce((sum, m) => {
      if (m.mode !== this._state.mode) return sum;
      if (m.mode === "distance") return sum + (m.distance || 0);
      if (m.mode === "circle") return sum + (m.radius || 0);
      return sum + (m.area || 0);
    }, 0);
    return completed + this._state.currentValue;
  }

  /**
   * Update the result display.
   */
  private _updateResult(): void {
    if (!this._resultValueEl || !this._resultUnitEl) return;

    const total = this._totalValue();
    let displayValue: number;
    let unitLabel: string;

    if (this._state.mode !== "area") {
      const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
      displayValue = total * factor;
      unitLabel = DISTANCE_UNITS[this._state.distanceUnit].label;
    } else {
      const factor = AREA_UNITS[this._state.areaUnit].factor;
      displayValue = total * factor;
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

  /** Add a precisely dimensioned geodesic segment from the last point. */
  private _addExactSegment(): void {
    if (
      this._state.mode !== "distance" ||
      this._state.currentPoints.length === 0
    ) {
      if (this._instructionsEl) {
        this._instructionsEl.textContent =
          "Place a starting point before adding an exact segment.";
      }
      return;
    }
    const lengthInput = this._panel?.querySelector(
      ".precision-length",
    ) as HTMLInputElement | null;
    const bearingInput = this._panel?.querySelector(
      ".precision-bearing",
    ) as HTMLInputElement | null;
    const displayedLength = Number(lengthInput?.value);
    const bearing = Number(bearingInput?.value);
    if (!(displayedLength > 0) || !Number.isFinite(bearing)) return;

    const meters =
      displayedLength / DISTANCE_UNITS[this._state.distanceUnit].factor;
    const start =
      this._state.currentPoints[this._state.currentPoints.length - 1];
    const point = destinationPoint(
      start,
      meters,
      bearing,
      this._options.radius,
    );
    this._state.currentPoints.push(point);
    this._addMarker(point);
    this._updateMeasurement();
    this._updateMapGeometry();
    this._emit("drawupdate");
    if (lengthInput) lengthInput.value = "";
  }

  /** Render the moving segment's dimensions beside the cursor. */
  private _updateLivePreview(points: MeasurePoint[], e: MapMouseEvent): void {
    if (!this._map || points.length < 2) return;
    if (!this._livePreviewEl) {
      this._livePreviewEl = document.createElement("div");
      this._livePreviewEl.className = "maplibre-gl-measure-live";
      this._map.getContainer().appendChild(this._livePreviewEl);
    }
    const last = points[points.length - 1];
    const previous = points[points.length - 2];
    const segment = haversineDistance(previous, last, this._options.radius);
    const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
    const unit = DISTANCE_UNITS[this._state.distanceUnit].label;
    const bearing = bearingBetween(previous, last);
    if (this._state.mode === "circle") {
      const areaFactor = AREA_UNITS[this._state.areaUnit].factor;
      this._livePreviewEl.textContent =
        `Radius ${(segment * factor).toFixed(this._options.precision)} ${unit} · ` +
        `Area ${(Math.PI * segment ** 2 * areaFactor).toFixed(this._options.precision)} ${AREA_UNITS[this._state.areaUnit].label}`;
    } else {
      const committed = this._state.currentValue;
      this._livePreviewEl.textContent =
        `${(segment * factor).toFixed(this._options.precision)} ${unit} · ` +
        `${bearing.toFixed(1)}° · Total ${((committed + segment) * factor).toFixed(this._options.precision)} ${unit}`;
    }
    const point = e.point;
    if (point) {
      this._livePreviewEl.style.left = `${point.x + 14}px`;
      this._livePreviewEl.style.top = `${point.y + 14}px`;
    }
  }

  private _removeLivePreview(): void {
    this._livePreviewEl?.remove();
    this._livePreviewEl = undefined;
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
      } else if (m.mode === "circle" && m.points.length >= 2) {
        const coords = circlePoints(
          m.points[0],
          m.radius ??
            haversineDistance(m.points[0], m.points[1], this._options.radius),
          this._options.radius,
        ).map((p) => [p.lng, p.lat]);
        coords.push(coords[0]);
        features.push({
          type: "Feature",
          properties: { id: m.id, mode: m.mode },
          geometry: { type: "Polygon", coordinates: [coords] },
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
      } else if (this._state.mode === "circle") {
        const circle = circlePoints(
          drawPoints[0],
          haversineDistance(drawPoints[0], drawPoints[1], this._options.radius),
          this._options.radius,
        ).map((p) => [p.lng, p.lat]);
        circle.push(circle[0]);
        features.push({
          type: "Feature",
          properties: { current: true, mode: "circle" },
          geometry: { type: "Polygon", coordinates: [circle] },
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

      const marker = new MaplibreMarker({ element: el, draggable: true })
        .setLngLat([point.lng, point.lat])
        .addTo(this._map);

      marker.on("drag", () => {
        const lngLat = marker.getLngLat();
        point.lng = lngLat.lng;
        point.lat = lngLat.lat;
        this._recomputeMeasurements();
        this._updateMapGeometry();
      });

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
        } else if (m.mode === "circle") {
          const factor = DISTANCE_UNITS[this._state.distanceUnit].factor;
          value = `${((m.radius || 0) * factor).toFixed(2)} ${DISTANCE_UNITS[this._state.distanceUnit].label} radius`;
          icon = CIRCLE_ICON;
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
    // The deleted measurement was part of the total; drop it from the readout.
    this._updateResult();

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
   * Get the radius, in meters, measurements are currently computed against.
   */
  getRadius(): number {
    return this._options.radius;
  }

  /**
   * Set the radius of the body being measured, in meters.
   *
   * Distances and areas come from lon/lat angles scaled by this radius, so
   * pointing it at another body's radius is what makes the readouts correct
   * there (3389500 for Mars, 1737400 for the Moon, and so on). Measurements
   * already on the map are recomputed from their points, so switching bodies
   * mid-session updates every result rather than leaving a mix of the two.
   *
   * Ignores a non-finite or non-positive radius, which would make every
   * subsequent measurement `NaN` or zero.
   */
  setRadius(radius: number): this {
    if (!isUsableRadius(radius)) return this;
    if (radius === this._options.radius) return this;
    this._options.radius = radius;
    this._recomputeMeasurements();
    // Anything that cached a value derived from a measurement (a host's own
    // panel section, a saved report) has just gone stale by the same ratio.
    this._emit("radiuschange");
    return this;
  }

  /**
   * Recompute every stored measurement, plus the drawing in progress, against
   * the current radius and refresh the panel.
   */
  private _recomputeMeasurements(): void {
    for (const measurement of this._state.measurements) {
      if (measurement.mode === "distance") {
        const segments: number[] = [];
        for (let i = 1; i < measurement.points.length; i++) {
          segments.push(
            haversineDistance(
              measurement.points[i - 1],
              measurement.points[i],
              this._options.radius,
            ),
          );
        }
        measurement.segments = segments;
        measurement.distance = segments.reduce((sum, d) => sum + d, 0);
      } else if (
        measurement.mode === "circle" &&
        measurement.points.length >= 2
      ) {
        measurement.radius = haversineDistance(
          measurement.points[0],
          measurement.points[1],
          this._options.radius,
        );
        measurement.area = Math.PI * measurement.radius ** 2;
      } else {
        measurement.area = calculatePolygonArea(
          measurement.points,
          this._options.radius,
        );
      }
    }
    // Re-derives the in-progress value and calls _updateResult() for us.
    this._updateMeasurement();
    this._updateMeasurementsList();
  }

  /**
   * Clear all measurements.
   */
  clear(): this {
    this._clearAll();
    return this;
  }
}
