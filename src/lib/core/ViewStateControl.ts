import type { IControl, Map as MapLibreMap, MapMouseEvent, GeoJSONSource } from 'maplibre-gl';
import type {
  ViewStateControlOptions,
  ViewStateControlState,
  ViewStateEvent,
  ViewStateEventHandler,
} from './types';
import { generateId } from '../utils/helpers';

/**
 * Default options for the ViewStateControl.
 */
const DEFAULT_OPTIONS: Required<ViewStateControlOptions> = {
  position: 'bottom-left',
  className: '',
  visible: true,
  collapsed: true,
  precision: 4,
  showCenter: true,
  showBounds: true,
  showZoom: true,
  showPitch: true,
  showBearing: true,
  enableBBox: false,
  bboxFillColor: 'rgba(0, 120, 215, 0.1)',
  bboxStrokeColor: '#0078d7',
  bboxStrokeWidth: 2,
  panelWidth: 280,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: 4,
  opacity: 1,
  fontSize: 12,
  fontColor: '#333',
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG icon for the view state button (crosshair/target).
 */
const VIEWSTATE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;

/**
 * SVG icon for copy button.
 */
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

/**
 * SVG checkmark icon for copy feedback.
 */
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * SVG icon for bbox draw button.
 */
const BBOX_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="4 2"/></svg>`;

/**
 * A control that displays live map view state (center, bounds, zoom, pitch, bearing)
 * and optionally supports drawing a bounding box to get bbox coordinates.
 *
 * @example
 * ```typescript
 * const viewStateControl = new ViewStateControl({
 *   collapsed: false,
 *   enableBBox: true,
 *   precision: 4,
 * });
 * map.addControl(viewStateControl, 'bottom-left');
 *
 * viewStateControl.on('bboxdraw', (event) => {
 *   console.log('Drawn bbox:', event.bbox);
 * });
 * ```
 */
export class ViewStateControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<ViewStateControlOptions>;
  private _state: ViewStateControlState;
  private _eventHandlers: Map<ViewStateEvent, Set<ViewStateEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // DOM references for live updates
  private _centerValueEl?: HTMLElement;
  private _boundsValueEl?: HTMLElement;
  private _zoomValueEl?: HTMLElement;
  private _pitchValueEl?: HTMLElement;
  private _bearingValueEl?: HTMLElement;

  // Move handler for live updates
  private _boundMoveHandler?: () => void;

  // BBox drawing state
  private _bboxSourceId: string = '';
  private _bboxLayerFillId: string = '';
  private _bboxLayerLineId: string = '';
  private _bboxDrawStart?: { lng: number; lat: number };
  private _boundBBoxMouseDown?: (e: MapMouseEvent) => void;
  private _boundBBoxMouseMove?: (e: MouseEvent) => void;
  private _boundBBoxMouseUp?: (e: MouseEvent) => void;
  private _boundBBoxDragStart?: (e: DragEvent) => void;
  private _bboxToggleBtn?: HTMLButtonElement;
  private _bboxResultEl?: HTMLElement;

  /**
   * Creates a new ViewStateControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: ViewStateControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      center: [0, 0],
      bounds: [0, 0, 0, 0],
      zoom: 0,
      pitch: 0,
      bearing: 0,
      drawingBBox: false,
      drawnBBox: null,
    };
    const uid = generateId('viewstate');
    this._bboxSourceId = `${uid}-bbox-src`;
    this._bboxLayerFillId = `${uid}-bbox-fill`;
    this._bboxLayerLineId = `${uid}-bbox-line`;
  }

  /**
   * Called when the control is added to the map.
   *
   * @param map - The MapLibre GL map instance.
   * @returns The control's container element.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._readMapState();
    this._container = this._createContainer();

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on('zoom', this._handleZoom);
    this._checkZoomVisibility();

    // Set up move listener for live updates
    this._boundMoveHandler = () => this._onMapMove();
    this._map.on('move', this._boundMoveHandler);

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    if (this._map) {
      if (this._handleZoom) {
        this._map.off('zoom', this._handleZoom);
        this._handleZoom = undefined;
      }
      if (this._boundMoveHandler) {
        this._map.off('move', this._boundMoveHandler);
        this._boundMoveHandler = undefined;
      }
      if (this._state.drawingBBox) {
        this._stopBBoxDrawing();
      }
      this._removeBBoxLayers();
    }
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._centerValueEl = undefined;
    this._boundsValueEl = undefined;
    this._zoomValueEl = undefined;
    this._pitchValueEl = undefined;
    this._bearingValueEl = undefined;
    this._bboxToggleBtn = undefined;
    this._bboxResultEl = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Expands the info panel.
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._updatePanelVisibility();
      this._updateButtonState();
      this._emit('expand');
    }
  }

  /**
   * Collapses the info panel.
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._updatePanelVisibility();
      this._updateButtonState();
      this._emit('collapse');
    }
  }

  /**
   * Toggles the panel expanded/collapsed state.
   */
  toggle(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Returns whether the panel is collapsed.
   */
  isCollapsed(): boolean {
    return this._state.collapsed;
  }

  /**
   * Shows the control.
   */
  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit('show');
    }
  }

  /**
   * Hides the control.
   */
  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit('hide');
    }
  }

  /**
   * Returns a copy of the current state.
   */
  getState(): ViewStateControlState {
    return { ...this._state };
  }

  /**
   * Starts bounding box drawing mode.
   */
  startBBoxDraw(): void {
    if (!this._options.enableBBox || this._state.drawingBBox) return;
    this._state.drawingBBox = true;
    this._setupBBoxListeners();
    this._updateBBoxToggleState();
    this._emit('drawstart');
  }

  /**
   * Stops bounding box drawing mode.
   */
  stopBBoxDraw(): void {
    if (!this._state.drawingBBox) return;
    this._stopBBoxDrawing();
    this._emit('drawend');
  }

  /**
   * Clears the drawn bounding box.
   */
  clearBBox(): void {
    this._state.drawnBBox = null;
    this._removeBBoxLayers();
    this._updateBBoxResult();
    this._emit('bboxclear');
  }

  /**
   * Updates the control options.
   */
  update(options: Partial<ViewStateControlOptions>): void {
    Object.assign(this._options, options);
    if (options.visible !== undefined) {
      this._state.visible = options.visible;
      this._updateDisplayState();
    }
    if (options.collapsed !== undefined) {
      this._state.collapsed = options.collapsed;
      this._updatePanelVisibility();
      this._updateButtonState();
    }
    if (options.panelWidth !== undefined && this._panel) {
      this._panel.style.width = `${options.panelWidth}px`;
    }
    this._emit('update');
  }

  /**
   * Registers an event handler.
   */
  on(event: ViewStateEvent, handler: ViewStateEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event handler.
   */
  off(event: ViewStateEvent, handler: ViewStateEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emits an event to all registered handlers.
   */
  private _emit(event: ViewStateEvent, bbox?: [number, number, number, number]): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) =>
        handler({
          type: event,
          state: this.getState(),
          bbox,
        })
      );
    }
  }

  /**
   * Reads the current map state into internal state.
   */
  private _readMapState(): void {
    if (!this._map) return;
    const center = this._map.getCenter();
    const bounds = this._map.getBounds();
    this._state.center = [center.lng, center.lat];
    this._state.bounds = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    this._state.zoom = this._map.getZoom();
    this._state.pitch = this._map.getPitch();
    this._state.bearing = this._map.getBearing();
  }

  /**
   * Handles map move events for live updates.
   */
  private _onMapMove(): void {
    this._readMapState();
    this._updateValues();
    this._emit('viewchange');
  }

  /**
   * Updates the DOM value elements with current state.
   */
  private _updateValues(): void {
    const p = this._options.precision;
    if (this._centerValueEl) {
      this._centerValueEl.textContent = `${this._state.center[0].toFixed(p)}, ${this._state.center[1].toFixed(p)}`;
    }
    if (this._boundsValueEl) {
      const b = this._state.bounds;
      this._boundsValueEl.textContent = `${b[0].toFixed(p)}, ${b[1].toFixed(p)}, ${b[2].toFixed(p)}, ${b[3].toFixed(p)}`;
    }
    if (this._zoomValueEl) {
      this._zoomValueEl.textContent = this._state.zoom.toFixed(2);
    }
    if (this._pitchValueEl) {
      this._pitchValueEl.textContent = `${this._state.pitch.toFixed(1)}°`;
    }
    if (this._bearingValueEl) {
      this._bearingValueEl.textContent = `${this._state.bearing.toFixed(1)}°`;
    }
  }

  /**
   * Creates the control container with button and panel.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-view-state ${this._options.className}`.trim();

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
    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'maplibre-gl-view-state-button';
    this._button.title = 'View map state';
    this._button.innerHTML = VIEWSTATE_ICON;
    this._button.addEventListener('click', () => this.toggle());
    container.appendChild(this._button);

    // Create panel
    this._panel = this._createPanel();
    container.appendChild(this._panel);

    // Set initial states
    container.style.display = this._state.visible ? 'block' : 'none';
    this._updatePanelVisibility();
    this._updateButtonState();

    return container;
  }

  /**
   * Creates the expandable info panel.
   */
  private _createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'maplibre-gl-view-state-panel';
    panel.style.width = `${this._options.panelWidth}px`;

    if (this._options.fontSize) {
      panel.style.fontSize = `${this._options.fontSize}px`;
    }
    if (this._options.fontColor) {
      panel.style.color = this._options.fontColor;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'maplibre-gl-view-state-header';
    header.textContent = 'View State';
    panel.appendChild(header);

    const p = this._options.precision;

    // Center row
    if (this._options.showCenter) {
      const { row, valueEl } = this._createRow(
        'Center',
        `${this._state.center[0].toFixed(p)}, ${this._state.center[1].toFixed(p)}`,
      );
      this._centerValueEl = valueEl;
      panel.appendChild(row);
    }

    // Bounds row
    if (this._options.showBounds) {
      const b = this._state.bounds;
      const { row, valueEl } = this._createRow(
        'Bounds',
        `${b[0].toFixed(p)}, ${b[1].toFixed(p)}, ${b[2].toFixed(p)}, ${b[3].toFixed(p)}`,
      );
      this._boundsValueEl = valueEl;
      panel.appendChild(row);
    }

    // Zoom row
    if (this._options.showZoom) {
      const { row, valueEl } = this._createRow('Zoom', this._state.zoom.toFixed(2));
      this._zoomValueEl = valueEl;
      panel.appendChild(row);
    }

    // Pitch row
    if (this._options.showPitch) {
      const { row, valueEl } = this._createRow('Pitch', `${this._state.pitch.toFixed(1)}°`);
      this._pitchValueEl = valueEl;
      panel.appendChild(row);
    }

    // Bearing row
    if (this._options.showBearing) {
      const { row, valueEl } = this._createRow('Bearing', `${this._state.bearing.toFixed(1)}°`);
      this._bearingValueEl = valueEl;
      panel.appendChild(row);
    }

    // BBox section
    if (this._options.enableBBox) {
      panel.appendChild(this._createBBoxSection());
    }

    return panel;
  }

  /**
   * Creates a labeled data row with a copy button.
   */
  private _createRow(label: string, value: string): { row: HTMLElement; valueEl: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'maplibre-gl-view-state-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'maplibre-gl-view-state-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'maplibre-gl-view-state-value';
    valueEl.textContent = value;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'maplibre-gl-view-state-copy';
    copyBtn.title = `Copy ${label.toLowerCase()}`;
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._copyToClipboard(valueEl.textContent || '', copyBtn);
    });

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    row.appendChild(copyBtn);

    return { row, valueEl };
  }

  /**
   * Creates the bounding box drawing section.
   */
  private _createBBoxSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'maplibre-gl-view-state-bbox-section';

    // Draw toggle button
    this._bboxToggleBtn = document.createElement('button');
    this._bboxToggleBtn.type = 'button';
    this._bboxToggleBtn.className = 'maplibre-gl-view-state-bbox-toggle';
    this._bboxToggleBtn.innerHTML = `${BBOX_ICON} Draw BBox`;
    this._bboxToggleBtn.addEventListener('click', () => {
      if (this._state.drawingBBox) {
        this.stopBBoxDraw();
      } else {
        this.startBBoxDraw();
      }
    });
    section.appendChild(this._bboxToggleBtn);

    // Result container (initially hidden)
    this._bboxResultEl = document.createElement('div');
    this._bboxResultEl.className = 'maplibre-gl-view-state-bbox-result';
    this._bboxResultEl.style.display = 'none';
    section.appendChild(this._bboxResultEl);

    return section;
  }

  /**
   * Updates the bbox result display.
   */
  private _updateBBoxResult(): void {
    if (!this._bboxResultEl) return;

    if (!this._state.drawnBBox) {
      this._bboxResultEl.style.display = 'none';
      return;
    }

    this._bboxResultEl.style.display = 'block';
    const b = this._state.drawnBBox;
    const p = this._options.precision;
    const bboxStr = `${b[0].toFixed(p)}, ${b[1].toFixed(p)}, ${b[2].toFixed(p)}, ${b[3].toFixed(p)}`;

    this._bboxResultEl.innerHTML = '';

    const valueDiv = document.createElement('div');
    valueDiv.className = 'maplibre-gl-view-state-bbox-value';
    valueDiv.textContent = bboxStr;
    this._bboxResultEl.appendChild(valueDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'maplibre-gl-view-state-bbox-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'maplibre-gl-view-state-bbox-action';
    copyBtn.innerHTML = `${COPY_ICON} Copy`;
    copyBtn.addEventListener('click', () => {
      this._copyToClipboard(bboxStr, copyBtn);
    });
    actionsDiv.appendChild(copyBtn);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'maplibre-gl-view-state-bbox-action maplibre-gl-view-state-bbox-action--clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => this.clearBBox());
    actionsDiv.appendChild(clearBtn);

    this._bboxResultEl.appendChild(actionsDiv);
  }

  /**
   * Copies text to clipboard and shows feedback on the button.
   */
  private _copyToClipboard(text: string, btn: HTMLButtonElement): void {
    navigator.clipboard.writeText(text).then(() => {
      const originalHtml = btn.innerHTML;
      btn.innerHTML = CHECK_ICON;
      setTimeout(() => {
        btn.innerHTML = originalHtml;
      }, 1000);
    }).catch(() => {
      // Fallback: select the text
    });
  }

  /**
   * Updates the panel visibility based on collapsed state.
   */
  private _updatePanelVisibility(): void {
    if (this._panel) {
      if (this._state.collapsed) {
        this._panel.classList.remove('maplibre-gl-view-state-panel--visible');
      } else {
        this._panel.classList.add('maplibre-gl-view-state-panel--visible');
      }
    }
  }

  /**
   * Updates the button's active state appearance.
   */
  private _updateButtonState(): void {
    if (this._button) {
      if (!this._state.collapsed) {
        this._button.classList.add('maplibre-gl-view-state-button--active');
        this._button.title = 'Hide view state';
      } else {
        this._button.classList.remove('maplibre-gl-view-state-button--active');
        this._button.title = 'View map state';
      }
    }
  }

  /**
   * Updates the bbox toggle button state.
   */
  private _updateBBoxToggleState(): void {
    if (this._bboxToggleBtn) {
      if (this._state.drawingBBox) {
        this._bboxToggleBtn.classList.add('maplibre-gl-view-state-bbox-toggle--active');
        this._bboxToggleBtn.innerHTML = `${BBOX_ICON} Cancel Draw`;
      } else {
        this._bboxToggleBtn.classList.remove('maplibre-gl-view-state-bbox-toggle--active');
        this._bboxToggleBtn.innerHTML = `${BBOX_ICON} Draw BBox`;
      }
    }
  }

  /**
   * Converts a native MouseEvent to map lng/lat using map.unproject().
   */
  private _mouseEventToLngLat(e: MouseEvent): { lng: number; lat: number } {
    const canvas = this._map!.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lngLat = this._map!.unproject([x, y]);
    return { lng: lngLat.lng, lat: lngLat.lat };
  }

  /**
   * Sets up mouse listeners for bbox drawing.
   */
  private _setupBBoxListeners(): void {
    if (!this._map) return;

    const canvas = this._map.getCanvas();
    canvas.style.cursor = 'crosshair';
    this._map.dragPan.disable();
    this._map.boxZoom.disable();

    this._boundBBoxMouseDown = (e: MapMouseEvent) => this._onBBoxMouseDown(e);
    this._map.on('mousedown', this._boundBBoxMouseDown);

    // Prevent native drag behavior on the canvas, which can swallow mousemove/mouseup events.
    this._boundBBoxDragStart = (e: DragEvent) => e.preventDefault();
    canvas.addEventListener('dragstart', this._boundBBoxDragStart);
  }

  /**
   * Removes bbox drawing listeners and restores map state.
   */
  private _stopBBoxDrawing(): void {
    if (!this._map) return;

    const canvas = this._map.getCanvas();
    canvas.style.cursor = '';
    this._map.dragPan.enable();
    this._map.boxZoom.enable();

    if (this._boundBBoxMouseDown) {
      this._map.off('mousedown', this._boundBBoxMouseDown);
      this._boundBBoxMouseDown = undefined;
    }
    if (this._boundBBoxMouseMove) {
      document.removeEventListener('mousemove', this._boundBBoxMouseMove);
      this._boundBBoxMouseMove = undefined;
    }
    if (this._boundBBoxMouseUp) {
      document.removeEventListener('mouseup', this._boundBBoxMouseUp);
      this._boundBBoxMouseUp = undefined;
    }
    if (this._boundBBoxDragStart) {
      canvas.removeEventListener('dragstart', this._boundBBoxDragStart);
      this._boundBBoxDragStart = undefined;
    }

    this._bboxDrawStart = undefined;
    this._state.drawingBBox = false;
    this._updateBBoxToggleState();
  }

  /**
   * Handles mouse down for bbox drawing start.
   */
  private _onBBoxMouseDown(e: MapMouseEvent): void {
    if (!this._map) return;
    e.preventDefault();
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    this._bboxDrawStart = { lng, lat };

    // Remove any existing bbox layers before drawing a new one
    this._removeBBoxLayers();

    // Initialize source with a degenerate polygon at the click point
    const pt: [number, number] = [lng, lat];
    this._map.addSource(this._bboxSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[pt, pt, pt, pt, pt]] },
        properties: {},
      },
    });

    this._map.addLayer({
      id: this._bboxLayerFillId,
      type: 'fill',
      source: this._bboxSourceId,
      paint: {
        'fill-color': this._options.bboxFillColor,
        'fill-opacity': 1,
      },
    });

    this._map.addLayer({
      id: this._bboxLayerLineId,
      type: 'line',
      source: this._bboxSourceId,
      paint: {
        'line-color': this._options.bboxStrokeColor,
        'line-width': this._options.bboxStrokeWidth,
      },
    });

    // Use native DOM events on document for mousemove/mouseup — MapLibre's
    // map events do not fire reliably during a button-held drag when dragPan
    // is disabled, because the browser may initiate a native drag on the canvas.
    this._boundBBoxMouseMove = (ev: MouseEvent) => this._onBBoxMouseMove(ev);
    this._boundBBoxMouseUp = (ev: MouseEvent) => this._onBBoxMouseUp(ev);
    document.addEventListener('mousemove', this._boundBBoxMouseMove);
    document.addEventListener('mouseup', this._boundBBoxMouseUp);
  }

  /**
   * Handles mouse move during bbox drawing.
   */
  private _onBBoxMouseMove(e: MouseEvent): void {
    if (!this._map || !this._bboxDrawStart) return;

    const start = this._bboxDrawStart;
    const current = this._mouseEventToLngLat(e);
    const coords = [
      [start.lng, start.lat],
      [current.lng, start.lat],
      [current.lng, current.lat],
      [start.lng, current.lat],
      [start.lng, start.lat],
    ];

    const source = this._map.getSource(this._bboxSourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      });
    }
  }

  /**
   * Handles mouse up to complete bbox drawing.
   */
  private _onBBoxMouseUp(e: MouseEvent): void {
    if (!this._map || !this._bboxDrawStart) return;

    const start = this._bboxDrawStart;
    const end = this._mouseEventToLngLat(e);

    // Normalize to [west, south, east, north]
    const west = Math.min(start.lng, end.lng);
    const south = Math.min(start.lat, end.lat);
    const east = Math.max(start.lng, end.lng);
    const north = Math.max(start.lat, end.lat);

    this._state.drawnBBox = [west, south, east, north];
    this._updateBBoxResult();

    // Update the source with the final rectangle so it remains visible
    const coords = [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ];
    const source = this._map.getSource(this._bboxSourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      });
    }

    // Stop drawing mode
    this._stopBBoxDrawing();

    this._emit('bboxdraw', this._state.drawnBBox);
    this._emit('drawend');
  }

  /**
   * Removes bbox layers and source from the map.
   */
  private _removeBBoxLayers(): void {
    if (!this._map) return;

    if (this._map.getLayer(this._bboxLayerFillId)) {
      this._map.removeLayer(this._bboxLayerFillId);
    }
    if (this._map.getLayer(this._bboxLayerLineId)) {
      this._map.removeLayer(this._bboxLayerLineId);
    }
    if (this._map.getSource(this._bboxSourceId)) {
      this._map.removeSource(this._bboxSourceId);
    }
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
    this._container.style.display = shouldShow ? 'block' : 'none';
  }
}
