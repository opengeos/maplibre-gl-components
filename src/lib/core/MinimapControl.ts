import "../styles/common.css";
import "../styles/minimap-control.css";
import maplibregl from "maplibre-gl";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  MinimapControlOptions,
  MinimapControlState,
  MinimapEvent,
  MinimapEventHandler,
} from "./types";

/**
 * Default options for the MinimapControl.
 */
const DEFAULT_OPTIONS: Required<MinimapControlOptions> = {
  position: "bottom-left",
  className: "",
  visible: true,
  collapsed: false,
  width: 250,
  height: 180,
  zoomOffset: -5,
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  viewportRectColor: "#0078d7",
  viewportRectOpacity: 0.2,
  toggleable: true,
  interactive: false,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG icon for the minimap toggle button.
 */
const MINIMAP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1" stroke-dasharray="2 2"/></svg>`;

const SOURCE_ID = "maplibre-minimap-viewport";
const FILL_LAYER_ID = "maplibre-minimap-viewport-fill";
const LINE_LAYER_ID = "maplibre-minimap-viewport-line";

/**
 * A control that displays a small overview map showing the current viewport extent.
 *
 * @example
 * ```typescript
 * const minimap = new MinimapControl({
 *   width: 250,
 *   height: 180,
 *   zoomOffset: -5,
 *   interactive: true,
 * });
 * map.addControl(minimap, 'bottom-left');
 * ```
 */
export class MinimapControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<MinimapControlOptions>;
  private _state: MinimapControlState;
  private _eventHandlers: Map<MinimapEvent, Set<MinimapEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _minimapMap?: maplibregl.Map;
  private _handleMove?: () => void;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _isDragging: boolean = false;
  private _dragStartLngLat?: { lng: number; lat: number };
  private _dragCleanup?: () => void;

  constructor(options?: MinimapControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
    };
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position;
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();

    // Setup zoom visibility handler
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);

    // Show panel if not collapsed
    if (!this._state.collapsed) {
      this._showPanel();
    }

    if (!this._state.visible) {
      this._container.style.display = "none";
    }

    return this._container;
  }

  onRemove(): void {
    if (this._dragCleanup) {
      this._dragCleanup();
      this._dragCleanup = undefined;
    }
    this._isDragging = false;
    this._dragStartLngLat = undefined;
    if (this._minimapMap) {
      this._minimapMap.remove();
      this._minimapMap = undefined;
    }
    if (this._map && this._handleMove) {
      this._map.off("move", this._handleMove);
    }
    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
    }
    if (this._container?.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._map = undefined;
  }

  /**
   * Register an event handler.
   */
  on(event: MinimapEvent, handler: MinimapEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: MinimapEvent, handler: MinimapEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(event: MinimapEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState() };
      handlers.forEach((handler) => handler(payload));
    }
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.classList.add("maplibregl-ctrl", "maplibre-gl-minimap-control");
    if (this._options.className) {
      container.classList.add(this._options.className);
    }

    if (this._options.toggleable) {
      this._button = document.createElement("button");
      this._button.type = "button";
      this._button.className = "minimap-button";
      this._button.title = "Toggle minimap";
      this._button.innerHTML = MINIMAP_ICON;
      this._button.addEventListener("click", () => this.toggle());
      container.appendChild(this._button);
    }

    return container;
  }

  private _showPanel(): void {
    if (!this._container || !this._map) return;
    if (this._panel) return; // already shown

    this._panel = document.createElement("div");
    this._panel.className = "minimap-panel";
    this._panel.style.width = `${this._options.width}px`;
    this._panel.style.height = `${this._options.height}px`;

    const mapDiv = document.createElement("div");
    mapDiv.className = "minimap-map";
    this._panel.appendChild(mapDiv);

    this._container.appendChild(this._panel);

    const mainCenter = this._map.getCenter();
    const mainZoom = this._map.getZoom();
    const minimapZoom = Math.max(0, mainZoom + this._options.zoomOffset);

    this._minimapMap = new maplibregl.Map({
      container: mapDiv,
      style: this._options.style as string,
      center: mainCenter,
      zoom: minimapZoom,
      interactive: false,
      attributionControl: false,
    });

    this._minimapMap.on("load", () => {
      this._addViewportRect();
      this._updateViewportRect();
    });

    // Sync on main map move (skipped during drag to avoid feedback loop)
    this._handleMove = () => {
      if (this._isDragging) return;
      this._syncMinimap();
      this._updateViewportRect();
    };
    this._map.on("move", this._handleMove);

    // Interactive: click to navigate + drag to pan
    if (this._options.interactive && this._minimapMap) {
      const canvas = this._minimapMap._canvas;
      canvas.style.cursor = "pointer";

      let mouseDownPos: { x: number; y: number } | null = null;
      let hasDragged = false;
      let dragStartMainCenter: { lng: number; lat: number } | null = null;

      const onMouseDown = (e: MouseEvent) => {
        if (!this._minimapMap || !this._map) return;
        e.preventDefault();
        this._isDragging = true;
        hasDragged = false;
        mouseDownPos = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = "grabbing";
        // Snapshot the minimap lngLat under the mouse and the main map center
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this._dragStartLngLat = this._minimapMap.unproject([x, y]);
        dragStartMainCenter = this._map.getCenter();
      };

      const onMouseMove = (e: MouseEvent) => {
        if (
          !this._isDragging ||
          !this._minimapMap ||
          !this._map ||
          !this._dragStartLngLat ||
          !dragStartMainCenter
        )
          return;

        // Check if we've moved enough to count as a drag (3px threshold)
        if (mouseDownPos && !hasDragged) {
          const dx = e.clientX - mouseDownPos.x;
          const dy = e.clientY - mouseDownPos.y;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasDragged = true;
          }
        }

        if (!hasDragged) return;

        // Minimap is frozen (sync paused), so unproject is stable
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const currentLngLat = this._minimapMap.unproject([x, y]);

        // How far the mouse moved in geographic coordinates on the minimap
        const dLng = currentLngLat.lng - this._dragStartLngLat.lng;
        const dLat = currentLngLat.lat - this._dragStartLngLat.lat;

        // Move main map by the same geographic offset
        this._map.setCenter([
          dragStartMainCenter.lng + dLng,
          dragStartMainCenter.lat + dLat,
        ]);

        // Update viewport rect to reflect new main map position
        this._updateViewportRect();
      };

      const onMouseUp = (e: MouseEvent) => {
        if (this._isDragging && !hasDragged && this._minimapMap && this._map) {
          // Simple click (no drag) — fly to that location
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const lngLat = this._minimapMap.unproject([x, y]);
          this._map.flyTo({ center: lngLat });
        }
        this._isDragging = false;
        hasDragged = false;
        mouseDownPos = null;
        dragStartMainCenter = null;
        this._dragStartLngLat = undefined;
        canvas.style.cursor = "pointer";
        // Re-sync minimap to final main map position
        this._syncMinimap();
        this._updateViewportRect();
      };

      canvas.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      // Store cleanup refs
      this._dragCleanup = () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    }
  }

  private _hidePanel(): void {
    if (this._dragCleanup) {
      this._dragCleanup();
      this._dragCleanup = undefined;
    }
    this._isDragging = false;
    this._dragStartLngLat = undefined;
    if (this._minimapMap) {
      this._minimapMap.remove();
      this._minimapMap = undefined;
    }
    if (this._map && this._handleMove) {
      this._map.off("move", this._handleMove);
      this._handleMove = undefined;
    }
    if (this._panel) {
      this._panel.remove();
      this._panel = undefined;
    }
  }

  private _syncMinimap(): void {
    if (!this._minimapMap || !this._map) return;
    const center = this._map.getCenter();
    const zoom = Math.max(0, this._map.getZoom() + this._options.zoomOffset);
    this._minimapMap.jumpTo({ center, zoom });
  }

  private _addViewportRect(): void {
    if (!this._minimapMap) return;

    this._minimapMap.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[]] },
        properties: {},
      },
    });

    this._minimapMap.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": this._options.viewportRectColor,
        "fill-opacity": this._options.viewportRectOpacity,
      },
    });

    this._minimapMap.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": this._options.viewportRectColor,
        "line-width": 2,
      },
    });
  }

  private _updateViewportRect(): void {
    if (!this._minimapMap || !this._map) return;

    const source = this._minimapMap.getSource(SOURCE_ID);
    if (!source || !("setData" in source)) return;

    const bounds = this._map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();

    const coordinates = [
      [sw.lng, sw.lat],
      [se.lng, se.lat],
      [ne.lng, ne.lat],
      [nw.lng, nw.lat],
      [sw.lng, sw.lat],
    ];

    (source as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coordinates] },
      properties: {},
    });
  }

  private _checkZoomVisibility(): void {
    if (!this._map || !this._container) return;
    const zoom = this._map.getZoom();
    const wasVisible = this._zoomVisible;
    this._zoomVisible =
      zoom >= this._options.minzoom && zoom <= this._options.maxzoom;
    if (wasVisible !== this._zoomVisible) {
      this._container.style.display =
        this._zoomVisible && this._state.visible ? "" : "none";
    }
  }

  /**
   * Show the control.
   */
  show(): this {
    this._state.visible = true;
    if (this._container) {
      this._container.style.display = this._zoomVisible ? "" : "none";
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
   * Expand the minimap (show the panel).
   */
  expand(): this {
    if (!this._state.collapsed) return this;
    this._state.collapsed = false;
    this._showPanel();
    this._emit("expand");
    return this;
  }

  /**
   * Collapse the minimap (hide the panel).
   */
  collapse(): this {
    if (this._state.collapsed) return this;
    this._state.collapsed = true;
    this._hidePanel();
    this._emit("collapse");
    return this;
  }

  /**
   * Toggle the collapsed state.
   */
  toggle(): this {
    return this._state.collapsed ? this.expand() : this.collapse();
  }

  /**
   * Get the current state.
   */
  getState(): MinimapControlState {
    return { ...this._state };
  }
}
