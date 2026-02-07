import "../styles/common.css";
import "../styles/inspect-control.css";
import maplibregl, {
  type IControl,
  type Map as MapLibreMap,
  type MapMouseEvent,
  Popup,
} from "maplibre-gl";
import type {
  InspectControlOptions,
  InspectControlState,
  InspectedFeature,
  InspectHighlightStyle,
  InspectEvent,
  InspectEventHandler,
} from "./types";
import { generateId } from "../utils/helpers";

/**
 * Default highlight style for selected features.
 */
const DEFAULT_HIGHLIGHT_STYLE: Required<InspectHighlightStyle> = {
  fillColor: "#ffff00",
  fillOpacity: 0.3,
  strokeColor: "#ffff00",
  strokeWidth: 3,
  circleRadius: 10,
  circleStrokeWidth: 3,
};

/**
 * Default options for the InspectControl.
 */
const DEFAULT_OPTIONS: Required<InspectControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  enabled: false,
  maxFeatures: 10,
  includeLayers: [],
  excludeLayers: [],
  highlightStyle: DEFAULT_HIGHLIGHT_STYLE,
  excludeProperties: [],
  showGeometryType: true,
  showLayerName: true,
  maxWidth: 320,
  maxHeight: 300,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  fontSize: 13,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG icon for the inspect button (info circle).
 */
const INSPECT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

/**
 * A control for inspecting vector features on the map.
 *
 * Provides click-to-inspect functionality that shows feature properties/attributes
 * in a popup. Supports multiple features at the same location with navigation.
 *
 * @example
 * ```typescript
 * const inspectControl = new InspectControl({
 *   excludeLayers: ['background'],
 *   highlightStyle: { strokeColor: '#00ff00', strokeWidth: 4 },
 * });
 * map.addControl(inspectControl, 'top-right');
 *
 * // Listen for feature selection
 * inspectControl.on('featureselect', (event) => {
 *   console.log('Selected:', event.feature);
 * });
 * ```
 */
export class InspectControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _options: Required<InspectControlOptions>;
  private _state: InspectControlState;
  private _eventHandlers: Map<InspectEvent, Set<InspectEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _popup?: Popup;
  private _highlightSourceId: string = "";
  private _highlightLayerIds: string[] = [];

  // Bound event handlers for proper cleanup
  private _boundClickHandler?: (e: MapMouseEvent) => void;

  /**
   * Creates a new InspectControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: InspectControlOptions) {
    this._options = {
      ...DEFAULT_OPTIONS,
      ...options,
      highlightStyle: {
        ...DEFAULT_HIGHLIGHT_STYLE,
        ...options?.highlightStyle,
      },
    };
    this._state = {
      visible: this._options.visible,
      enabled: this._options.enabled,
      inspectedFeatures: [],
      selectedIndex: 0,
      error: null,
    };
    this._highlightSourceId = `inspect-highlight-${generateId()}`;
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

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);

    // Check initial zoom
    this._checkZoomVisibility();

    // If enabled by default, set up click handler
    if (this._state.enabled) {
      this._setupMapListeners();
    }

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
    this._removeMapListeners();
    this._removeHighlight();
    this._hidePopup();
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Enables inspect mode.
   */
  enable(): void {
    if (!this._state.enabled) {
      this._state.enabled = true;
      this._updateButtonState();
      this._setupMapListeners();
      this._updateCursor(true);
      this._emit("enable");
    }
  }

  /**
   * Disables inspect mode.
   */
  disable(): void {
    if (this._state.enabled) {
      this._state.enabled = false;
      this._updateButtonState();
      this._removeMapListeners();
      this._updateCursor(false);
      this.clear();
      this._emit("disable");
    }
  }

  /**
   * Toggles inspect mode on/off.
   */
  toggle(): void {
    if (this._state.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Returns whether inspect mode is enabled.
   */
  isEnabled(): boolean {
    return this._state.enabled;
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
      this._state.visible = true;
      this._updateDisplayState();
      this._emit("hide");
    }
  }

  /**
   * Clears the current inspection.
   */
  clear(): void {
    this._state.inspectedFeatures = [];
    this._state.selectedIndex = 0;
    this._removeHighlight();
    this._hidePopup();
    this._emit("clear");
  }

  /**
   * Returns a copy of the current state.
   */
  getState(): InspectControlState {
    return { ...this._state };
  }

  /**
   * Returns the currently inspected features.
   */
  getInspectedFeatures(): InspectedFeature[] {
    return [...this._state.inspectedFeatures];
  }

  /**
   * Returns the currently selected feature.
   */
  getSelectedFeature(): InspectedFeature | null {
    return this._state.inspectedFeatures[this._state.selectedIndex] || null;
  }

  /**
   * Selects a feature by index.
   */
  selectFeature(index: number): void {
    if (index >= 0 && index < this._state.inspectedFeatures.length) {
      this._state.selectedIndex = index;
      const feature = this._state.inspectedFeatures[index];
      this._addHighlight(feature);
      this._updatePopupContent();
      this._emit("featureselect", feature);
    }
  }

  /**
   * Selects the next feature.
   */
  nextFeature(): void {
    if (this._state.inspectedFeatures.length > 1) {
      const nextIndex =
        (this._state.selectedIndex + 1) % this._state.inspectedFeatures.length;
      this.selectFeature(nextIndex);
    }
  }

  /**
   * Selects the previous feature.
   */
  previousFeature(): void {
    if (this._state.inspectedFeatures.length > 1) {
      const prevIndex =
        this._state.selectedIndex === 0
          ? this._state.inspectedFeatures.length - 1
          : this._state.selectedIndex - 1;
      this.selectFeature(prevIndex);
    }
  }

  /**
   * Updates the control options.
   */
  update(options: Partial<InspectControlOptions>): void {
    Object.assign(this._options, options);
    if (options.highlightStyle) {
      this._options.highlightStyle = {
        ...DEFAULT_HIGHLIGHT_STYLE,
        ...options.highlightStyle,
      };
    }
    if (options.visible !== undefined) {
      this._state.visible = options.visible;
      this._updateDisplayState();
    }
    if (options.enabled !== undefined) {
      if (options.enabled) {
        this.enable();
      } else {
        this.disable();
      }
    }
    this._emit("update");
  }

  /**
   * Registers an event handler.
   */
  on(event: InspectEvent, handler: InspectEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event handler.
   */
  off(event: InspectEvent, handler: InspectEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emits an event to all registered handlers.
   */
  private _emit(event: InspectEvent, feature?: InspectedFeature): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) =>
        handler({
          type: event,
          state: this.getState(),
          feature,
          features: this._state.inspectedFeatures,
        }),
      );
    }
  }

  /**
   * Creates the control container.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className =
      `maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-inspect ${this._options.className}`.trim();

    // Apply custom styling
    if (this._options.backgroundColor) {
      container.style.backgroundColor = this._options.backgroundColor;
    }
    if (this._options.borderRadius) {
      container.style.borderRadius = `${this._options.borderRadius}px`;
    }
    if (this._options.opacity !== undefined && this._options.opacity !== 1) {
      container.style.opacity = String(this._options.opacity);
    }

    // Create button
    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "maplibre-gl-inspect-button";
    this._button.title = "Inspect features";
    this._button.innerHTML = INSPECT_ICON;
    this._button.addEventListener("click", () => this.toggle());

    container.appendChild(this._button);

    // Set initial display state
    container.style.display = this._state.visible ? "block" : "none";

    return container;
  }

  /**
   * Updates the button's active state appearance.
   */
  private _updateButtonState(): void {
    if (this._button) {
      if (this._state.enabled) {
        this._button.classList.add("maplibre-gl-inspect-button--active");
        this._button.title = "Disable inspect mode";
      } else {
        this._button.classList.remove("maplibre-gl-inspect-button--active");
        this._button.title = "Inspect features";
      }
    }
  }

  /**
   * Updates the cursor style when inspect mode is active.
   */
  private _updateCursor(inspectMode: boolean): void {
    if (this._map) {
      const canvas = this._map.getCanvas();
      if (inspectMode) {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = "";
      }
    }
  }

  /**
   * Sets up map click listener for inspect mode.
   */
  private _setupMapListeners(): void {
    if (!this._map || this._boundClickHandler) return;

    this._boundClickHandler = (e: MapMouseEvent) => this._handleMapClick(e);
    this._map.on("click", this._boundClickHandler);
  }

  /**
   * Removes map click listener.
   */
  private _removeMapListeners(): void {
    if (this._map && this._boundClickHandler) {
      this._map.off("click", this._boundClickHandler);
      this._boundClickHandler = undefined;
    }
  }

  /**
   * Handles map click events to inspect features.
   */
  private _handleMapClick(e: MapMouseEvent): void {
    if (!this._map) return;

    const point = e.point;
    const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    // Query features at click point
    const features = this._queryFeatures(point);

    if (features.length === 0) {
      this.clear();
      return;
    }

    // Convert to InspectedFeature format
    const inspectedFeatures: InspectedFeature[] = features
      .slice(0, this._options.maxFeatures)
      .map((f) => {
        const featureId = f.id;
        const feature: GeoJSON.Feature = {
          type: "Feature" as const,
          geometry: f.geometry,
          properties: f.properties || {},
        };
        if (featureId !== undefined) {
          feature.id = featureId;
        }

        return {
          id: generateId("inspect"),
          feature,
          layerId: f.layer?.id || "unknown",
          sourceId: f.source || "unknown",
          sourceLayer: f.sourceLayer,
          featureId: featureId === undefined ? undefined : featureId,
          lngLat,
        };
      });

    this._state.inspectedFeatures = inspectedFeatures;
    this._state.selectedIndex = 0;

    const selectedFeature = inspectedFeatures[0];
    this._addHighlight(selectedFeature);
    this._showPopup(selectedFeature, lngLat);
    this._emit("featureselect", selectedFeature);
  }

  /**
   * Queries features at a point.
   */
  private _queryFeatures(
    point: maplibregl.PointLike,
  ): maplibregl.MapGeoJSONFeature[] {
    if (!this._map) return [];

    const queryOptions: { layers?: string[] } = {};

    // If includeLayers is specified, only query those layers
    if (this._options.includeLayers.length > 0) {
      queryOptions.layers = this._options.includeLayers;
    }

    let features = this._map.queryRenderedFeatures(point, queryOptions);

    // Filter out excluded layers
    if (this._options.excludeLayers.length > 0) {
      features = features.filter(
        (f) => f.layer && !this._options.excludeLayers.includes(f.layer.id),
      );
    }

    // Filter out highlight layers
    features = features.filter(
      (f) => f.layer && !f.layer.id.startsWith("inspect-highlight-"),
    );

    return features;
  }

  /**
   * Adds highlight layer for the selected feature.
   */
  private _addHighlight(inspectedFeature: InspectedFeature): void {
    if (!this._map) return;

    // Remove existing highlight
    this._removeHighlight();

    const feature = inspectedFeature.feature;
    const geometryType = feature.geometry.type;
    const style = this._options.highlightStyle;

    const highlightTarget = this._getHighlightTarget(inspectedFeature);
    const highlightSourceId =
      highlightTarget?.sourceId ?? this._highlightSourceId;
    const highlightSourceLayer = highlightTarget?.sourceLayer;
    const highlightFilter = highlightTarget?.filter;

    if (!highlightTarget) {
      // Add source only when we can't use the original source for highlighting.
      this._map.addSource(this._highlightSourceId, {
        type: "geojson",
        data: feature,
      });
    }

    const layerBase: {
      source: string;
      "source-layer"?: string;
      filter?: maplibregl.FilterSpecification;
    } = { source: highlightSourceId };

    if (highlightSourceLayer) {
      layerBase["source-layer"] = highlightSourceLayer;
    }

    if (highlightFilter) {
      layerBase.filter = highlightFilter;
    }

    // Add appropriate layer(s) based on geometry type
    if (geometryType === "Point" || geometryType === "MultiPoint") {
      const layerId = `${this._highlightSourceId}-circle`;
      this._map.addLayer({
        id: layerId,
        type: "circle",
        ...layerBase,
        paint: {
          "circle-radius": style.circleRadius,
          "circle-color": style.fillColor,
          "circle-opacity": style.fillOpacity,
          "circle-stroke-color": style.strokeColor,
          "circle-stroke-width": style.circleStrokeWidth,
        },
      });
      this._highlightLayerIds.push(layerId);
    } else if (
      geometryType === "LineString" ||
      geometryType === "MultiLineString"
    ) {
      const layerId = `${this._highlightSourceId}-line`;
      this._map.addLayer({
        id: layerId,
        type: "line",
        ...layerBase,
        paint: {
          "line-color": style.strokeColor,
          "line-width": style.strokeWidth,
          "line-opacity": 1,
        },
      });
      this._highlightLayerIds.push(layerId);
    } else if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
      // Fill layer
      const fillLayerId = `${this._highlightSourceId}-fill`;
      this._map.addLayer({
        id: fillLayerId,
        type: "fill",
        ...layerBase,
        paint: {
          "fill-color": style.fillColor,
          "fill-opacity": style.fillOpacity,
        },
      });
      this._highlightLayerIds.push(fillLayerId);

      // Outline layer
      const lineLayerId = `${this._highlightSourceId}-outline`;
      this._map.addLayer({
        id: lineLayerId,
        type: "line",
        ...layerBase,
        paint: {
          "line-color": style.strokeColor,
          "line-width": style.strokeWidth,
        },
      });
      this._highlightLayerIds.push(lineLayerId);
    }
  }

  /**
   * Determines if highlight can use the original source to avoid tile clipping.
   */
  private _getHighlightTarget(
    inspectedFeature: InspectedFeature,
  ): {
    sourceId: string;
    sourceLayer?: string;
    filter: maplibregl.FilterSpecification;
  } | null {
    if (!this._map) return null;

    const { sourceId, sourceLayer, featureId, layerId } = inspectedFeature;
    if (!sourceId || sourceId === "unknown") return null;
    if (featureId === null || featureId === undefined) return null;

    const source = this._map.getSource(sourceId) as
      | maplibregl.Source
      | undefined;
    if (!source) return null;

    if (source.type === "vector" && !sourceLayer) return null;

    const idFilter: maplibregl.FilterSpecification = ["==", ["id"], featureId];
    const layerFilter = this._map.getLayer(layerId)?.filter;
    const combinedFilter = layerFilter
      ? (["all", idFilter, layerFilter] as maplibregl.FilterSpecification)
      : idFilter;

    return { sourceId, sourceLayer, filter: combinedFilter };
  }

  /**
   * Removes highlight layers.
   */
  private _removeHighlight(): void {
    if (!this._map) return;

    // Remove layers
    for (const layerId of this._highlightLayerIds) {
      if (this._map.getLayer(layerId)) {
        this._map.removeLayer(layerId);
      }
    }
    this._highlightLayerIds = [];

    // Remove source
    if (this._map.getSource(this._highlightSourceId)) {
      this._map.removeSource(this._highlightSourceId);
    }
  }

  /**
   * Shows the popup with feature properties.
   */
  private _showPopup(
    _inspectedFeature: InspectedFeature,
    lngLat: [number, number],
  ): void {
    if (!this._map) return;

    // Remove existing popup
    this._hidePopup();

    const html = this._renderPopupContent();

    this._popup = new Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: `${this._options.maxWidth}px`,
      className: "maplibre-gl-inspect-popup",
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(this._map);

    // Attach listeners after DOM is ready
    requestAnimationFrame(() => {
      this._attachPopupListeners();
    });
  }

  /**
   * Hides the popup.
   */
  private _hidePopup(): void {
    if (this._popup) {
      this._popup.remove();
      this._popup = undefined;
    }
  }

  /**
   * Updates the popup content without recreating it.
   */
  private _updatePopupContent(): void {
    if (this._popup) {
      const html = this._renderPopupContent();
      this._popup.setHTML(html);
      this._attachPopupListeners();
    }
  }

  /**
   * Attaches event listeners to popup navigation buttons.
   */
  private _attachPopupListeners(): void {
    if (!this._popup) return;

    // Get the popup's DOM element
    const popupEl = this._popup.getElement();
    if (!popupEl) return;

    const prevBtn = popupEl.querySelector(
      ".maplibre-gl-inspect-nav-prev",
    ) as HTMLButtonElement;
    const nextBtn = popupEl.querySelector(
      ".maplibre-gl-inspect-nav-next",
    ) as HTMLButtonElement;

    if (prevBtn) {
      // Use onclick to replace any existing handler
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.previousFeature();
      };
    }

    if (nextBtn) {
      // Use onclick to replace any existing handler
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.nextFeature();
      };
    }
  }

  /**
   * Renders the popup HTML content.
   */
  private _renderPopupContent(): string {
    const features = this._state.inspectedFeatures;
    const selectedIndex = this._state.selectedIndex;
    const feature = features[selectedIndex];

    if (!feature) {
      return '<div class="maplibre-gl-inspect-empty">No feature selected</div>';
    }

    const geometryType = feature.feature.geometry.type;
    const layerId = feature.layerId;
    const properties = feature.feature.properties || {};

    // Header
    let html = '<div class="maplibre-gl-inspect-header">';

    if (this._options.showGeometryType) {
      html += `<span class="maplibre-gl-inspect-geometry">${this._formatGeometryType(geometryType)}</span>`;
    }

    if (this._options.showLayerName) {
      html += `<span class="maplibre-gl-inspect-layer" title="${layerId}">${layerId}</span>`;
    }

    // Navigation (if multiple features)
    if (features.length > 1) {
      const prevDisabled = features.length <= 1 ? "disabled" : "";
      const nextDisabled = features.length <= 1 ? "disabled" : "";
      html += `
        <span class="maplibre-gl-inspect-nav">
          <button class="maplibre-gl-inspect-nav-prev" ${prevDisabled} title="Previous feature">&lt;</button>
          <span class="maplibre-gl-inspect-nav-count">${selectedIndex + 1}/${features.length}</span>
          <button class="maplibre-gl-inspect-nav-next" ${nextDisabled} title="Next feature">&gt;</button>
        </span>
      `;
    }

    html += "</div>";

    // Properties table
    html += `<div class="maplibre-gl-inspect-content" style="max-height: ${this._options.maxHeight}px;">`;

    const propertyKeys = Object.keys(properties).filter(
      (key) => !this._options.excludeProperties.includes(key),
    );

    if (propertyKeys.length === 0) {
      html += '<div class="maplibre-gl-inspect-empty">No properties</div>';
    } else {
      html += '<table class="maplibre-gl-inspect-properties">';
      for (const key of propertyKeys) {
        const value = properties[key];
        const formattedValue = this._formatPropertyValue(value);
        const valueClass =
          value === null || value === undefined ? "value null" : "value";
        html += `
          <tr>
            <td class="key">${this._escapeHtml(key)}</td>
            <td class="${valueClass}">${formattedValue}</td>
          </tr>
        `;
      }
      html += "</table>";
    }

    html += "</div>";

    return html;
  }

  /**
   * Formats geometry type for display.
   */
  private _formatGeometryType(type: string): string {
    // Remove "Multi" prefix for cleaner display
    return type.replace("Multi", "");
  }

  /**
   * Formats a property value for display.
   */
  private _formatPropertyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "<em>N/A</em>";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      // Format numbers with appropriate precision
      if (Number.isInteger(value)) {
        return this._escapeHtml(value.toLocaleString());
      }
      return this._escapeHtml(value.toFixed(4));
    }

    if (typeof value === "string") {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return this._escapeHtml(date.toLocaleString());
          }
        } catch {
          // Not a valid date, continue
        }
      }

      // Truncate long strings
      if (value.length > 100) {
        return this._escapeHtml(value.substring(0, 100)) + "...";
      }

      return this._escapeHtml(value);
    }

    if (typeof value === "object") {
      // For arrays and objects, show JSON
      try {
        const json = JSON.stringify(value, null, 2);
        if (json.length > 200) {
          return `<pre>${this._escapeHtml(json.substring(0, 200))}...</pre>`;
        }
        return `<pre>${this._escapeHtml(json)}</pre>`;
      } catch {
        return "[Object]";
      }
    }

    return this._escapeHtml(String(value));
  }

  /**
   * Escapes HTML special characters.
   */
  private _escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Checks zoom visibility and updates display state.
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
   * Updates the display state based on visibility settings.
   */
  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? "block" : "none";
  }
}
