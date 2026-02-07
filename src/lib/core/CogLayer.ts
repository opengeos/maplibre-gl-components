import '../styles/common.css';
import '../styles/cog-layer.css';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  CogLayerControlOptions,
  CogLayerControlState,
  CogLayerEvent,
  CogLayerEventHandler,
  ColormapName,
} from './types';

/**
 * All available colormap names for the dropdown.
 */
const COLORMAP_NAMES: (ColormapName | 'none')[] = [
  'none',
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'cividis',
  'coolwarm',
  'bwr',
  'seismic',
  'RdBu',
  'RdYlBu',
  'RdYlGn',
  'spectral',
  'jet',
  'rainbow',
  'turbo',
  'terrain',
  'ocean',
  'hot',
  'cool',
  'gray',
  'bone',
];

/**
 * Default options for the CogLayerControl.
 */
const DEFAULT_OPTIONS: Required<CogLayerControlOptions> = {
  position: 'top-right',
  className: '',
  visible: true,
  collapsed: true,
  defaultUrl: '',
  defaultBands: '1',
  defaultColormap: 'viridis',
  defaultRescaleMin: 0,
  defaultRescaleMax: 255,
  defaultNodata: 0,
  defaultOpacity: 1,
  panelWidth: 300,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: 4,
  opacity: 1,
  fontSize: 13,
  fontColor: '#333',
  minzoom: 0,
  maxzoom: 24,
};

/**
 * Satellite/raster icon SVG for the COG layer toggle button.
 */
const COG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 12h20"/><path d="M12 2v20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 2v5"/><path d="M17 17v5"/></svg>`;

/**
 * A control for adding Cloud Optimized GeoTIFF (COG) layers to the map.
 *
 * Uses deck.gl's COGLayer rendered through MapboxOverlay for efficient
 * streaming and rendering of COG imagery.
 *
 * @example
 * ```typescript
 * const cogControl = new CogLayerControl({
 *   defaultUrl: 'https://example.com/cog.tif',
 *   defaultColormap: 'terrain',
 * });
 * map.addControl(cogControl, 'top-right');
 *
 * cogControl.on('layeradd', (event) => {
 *   console.log('COG layer added:', event.url);
 * });
 * ```
 */
export class CogLayerControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<CogLayerControlOptions>;
  private _state: CogLayerControlState;
  private _eventHandlers: Map<CogLayerEvent, Set<CogLayerEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _deckOverlay?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayer?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _COGLayerClass?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayerProps?: Record<string, any>;

  constructor(options?: CogLayerControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      url: this._options.defaultUrl,
      bands: this._options.defaultBands,
      colormap: this._options.defaultColormap,
      rescaleMin: this._options.defaultRescaleMin,
      rescaleMax: this._options.defaultRescaleMax,
      nodata: this._options.defaultNodata,
      layerOpacity: this._options.defaultOpacity,
      hasLayer: false,
      loading: false,
      error: null,
      status: null,
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._render();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on('zoom', this._handleZoom);
    this._checkZoomVisibility();

    return this._container;
  }

  onRemove(): void {
    this._removeLayer();

    if (this._map && this._handleZoom) {
      this._map.off('zoom', this._handleZoom);
      this._handleZoom = undefined;
    }

    if (this._deckOverlay && this._map) {
      try {
        (this._map as unknown as { removeControl(c: IControl): void }).removeControl(this._deckOverlay);
      } catch {
        // overlay may already be removed
      }
      this._deckOverlay = undefined;
    }

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._eventHandlers.clear();
  }

  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit('show');
    }
  }

  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit('hide');
    }
  }

  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit('expand');
    }
  }

  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit('collapse');
    }
  }

  toggle(): void {
    if (this._state.collapsed) this.expand();
    else this.collapse();
  }

  getState(): CogLayerControlState {
    return { ...this._state };
  }

  update(options: Partial<CogLayerControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined) this._state.collapsed = options.collapsed;
    this._render();
    this._emit('update');
  }

  on(event: CogLayerEvent, handler: CogLayerEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: CogLayerEvent, handler: CogLayerEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Programmatically add a COG layer.
   */
  async addLayer(url?: string): Promise<void> {
    if (url) this._state.url = url;
    await this._addLayer();
  }

  /**
   * Programmatically remove the COG layer.
   */
  removeLayer(): void {
    this._removeLayer();
    this._render();
  }

  private _emit(event: CogLayerEvent, extra?: { url?: string; error?: string }): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), ...extra };
      handlers.forEach((h) => h(payload));
    }
  }

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

  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? 'block' : 'none';
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibre-gl-cog-layer${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) container.style.display = 'none';

    Object.assign(container.style, {
      backgroundColor: this._options.backgroundColor,
      borderRadius: `${this._options.borderRadius}px`,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
    });
    if (this._options.opacity !== 1) {
      container.style.opacity = String(this._options.opacity);
    }

    return container;
  }

  private _render(): void {
    if (!this._container) return;
    this._container.innerHTML = '';

    if (this._state.collapsed) {
      this._renderCollapsed();
    } else {
      this._renderExpanded();
    }

    this._updateDisplayState();
  }

  private _renderCollapsed(): void {
    if (!this._container) return;

    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = `maplibre-gl-cog-layer-button${this._state.hasLayer ? ' maplibre-gl-cog-layer-button--active' : ''}`;
    this._button.title = 'COG Layer';
    this._button.setAttribute('aria-label', 'COG Layer');
    this._button.innerHTML = COG_ICON;
    this._button.addEventListener('click', () => this.expand());

    this._container.appendChild(this._button);
    this._panel = undefined;
  }

  private _renderExpanded(): void {
    if (!this._container) return;

    const panel = document.createElement('div');
    panel.className = 'maplibre-gl-cog-layer-panel';
    panel.style.width = `${this._options.panelWidth}px`;
    this._panel = panel;

    // Header
    const header = document.createElement('div');
    header.className = 'maplibre-gl-cog-layer-header';
    const title = document.createElement('span');
    title.className = 'maplibre-gl-cog-layer-title';
    title.textContent = 'COG Layer';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'maplibre-gl-cog-layer-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // URL input
    const urlGroup = this._createFormGroup('COG URL', 'url');
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'maplibre-gl-cog-layer-input';
    urlInput.placeholder = 'https://example.com/cog.tif';
    urlInput.value = this._state.url;
    urlInput.addEventListener('input', () => { this._state.url = urlInput.value; });
    urlGroup.appendChild(urlInput);
    panel.appendChild(urlGroup);

    // Bands input
    const bandsGroup = this._createFormGroup('Bands (comma-separated)', 'bands');
    const bandsInput = document.createElement('input');
    bandsInput.type = 'text';
    bandsInput.className = 'maplibre-gl-cog-layer-input';
    bandsInput.placeholder = '1 or 1,2,3';
    bandsInput.value = this._state.bands;
    bandsInput.addEventListener('input', () => { this._state.bands = bandsInput.value; });
    bandsGroup.appendChild(bandsInput);
    panel.appendChild(bandsGroup);

    // Colormap dropdown
    const cmGroup = this._createFormGroup('Colormap', 'colormap');
    const cmSelect = document.createElement('select');
    cmSelect.className = 'maplibre-gl-cog-layer-select';
    for (const name of COLORMAP_NAMES) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name === 'none' ? 'none (RGB)' : name;
      if (name === this._state.colormap) opt.selected = true;
      cmSelect.appendChild(opt);
    }
    cmSelect.addEventListener('change', () => {
      this._state.colormap = cmSelect.value as ColormapName | 'none';
    });
    cmGroup.appendChild(cmSelect);
    panel.appendChild(cmGroup);

    // Rescale min/max row
    const rescaleRow = document.createElement('div');
    rescaleRow.className = 'maplibre-gl-cog-layer-row';
    const minGroup = this._createFormGroup('Rescale Min', 'rescale-min');
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'maplibre-gl-cog-layer-input';
    minInput.value = String(this._state.rescaleMin);
    minInput.addEventListener('input', () => {
      this._state.rescaleMin = Number(minInput.value) || 0;
    });
    minGroup.appendChild(minInput);
    rescaleRow.appendChild(minGroup);
    const maxGroup = this._createFormGroup('Rescale Max', 'rescale-max');
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'maplibre-gl-cog-layer-input';
    maxInput.value = String(this._state.rescaleMax);
    maxInput.addEventListener('input', () => {
      this._state.rescaleMax = Number(maxInput.value) || 0;
    });
    maxGroup.appendChild(maxInput);
    rescaleRow.appendChild(maxGroup);
    panel.appendChild(rescaleRow);

    // Nodata
    const nodataGroup = this._createFormGroup('Nodata', 'nodata');
    const nodataInput = document.createElement('input');
    nodataInput.type = 'number';
    nodataInput.className = 'maplibre-gl-cog-layer-input';
    nodataInput.placeholder = 'e.g. 0 or -9999';
    nodataInput.value = this._state.nodata !== undefined ? String(this._state.nodata) : '';
    nodataInput.addEventListener('input', () => {
      this._state.nodata = nodataInput.value !== '' ? Number(nodataInput.value) : undefined;
    });
    nodataGroup.appendChild(nodataInput);
    panel.appendChild(nodataGroup);

    // Opacity slider
    const opacityGroup = this._createFormGroup('Opacity', 'opacity');
    const sliderRow = document.createElement('div');
    sliderRow.className = 'maplibre-gl-cog-layer-slider-row';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'maplibre-gl-cog-layer-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(this._state.layerOpacity * 100));
    const sliderValue = document.createElement('span');
    sliderValue.className = 'maplibre-gl-cog-layer-slider-value';
    sliderValue.textContent = `${Math.round(this._state.layerOpacity * 100)}%`;
    slider.addEventListener('input', () => {
      const pct = Number(slider.value);
      this._state.layerOpacity = pct / 100;
      sliderValue.textContent = `${pct}%`;
      this._updateOpacity();
    });
    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderValue);
    opacityGroup.appendChild(sliderRow);
    panel.appendChild(opacityGroup);

    // Buttons
    const btns = document.createElement('div');
    btns.className = 'maplibre-gl-cog-layer-buttons';

    if (!this._state.hasLayer) {
      const addBtn = document.createElement('button');
      addBtn.className = 'maplibre-gl-cog-layer-btn maplibre-gl-cog-layer-btn--primary';
      addBtn.textContent = 'Add Layer';
      addBtn.disabled = this._state.loading;
      addBtn.addEventListener('click', () => this._addLayer());
      btns.appendChild(addBtn);
    } else {
      const updateBtn = document.createElement('button');
      updateBtn.className = 'maplibre-gl-cog-layer-btn maplibre-gl-cog-layer-btn--primary';
      updateBtn.textContent = 'Update Layer';
      updateBtn.disabled = this._state.loading;
      updateBtn.addEventListener('click', () => this._updateLayer());
      btns.appendChild(updateBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'maplibre-gl-cog-layer-btn maplibre-gl-cog-layer-btn--danger';
      removeBtn.textContent = 'Remove Layer';
      removeBtn.addEventListener('click', () => {
        this._removeLayer();
        this._render();
      });
      btns.appendChild(removeBtn);
    }

    panel.appendChild(btns);

    // Status/error area
    if (this._state.loading) {
      this._appendStatus('Loading COG...', 'info');
    } else if (this._state.error) {
      this._appendStatus(this._state.error, 'error');
    } else if (this._state.status) {
      this._appendStatus(this._state.status, 'success');
    }

    this._container.appendChild(panel);
    this._button = undefined;
  }

  private _createFormGroup(labelText: string, id: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'maplibre-gl-cog-layer-form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.htmlFor = `cog-layer-${id}`;
    group.appendChild(label);
    return group;
  }

  private _appendStatus(message: string, type: 'info' | 'error' | 'success'): void {
    if (!this._panel) return;
    const status = document.createElement('div');
    status.className = `maplibre-gl-cog-layer-status maplibre-gl-cog-layer-status--${type}`;
    status.textContent = message;
    this._panel.appendChild(status);
  }

  private async _ensureOverlay(): Promise<void> {
    if (this._deckOverlay) return;
    if (!this._map) return;

    const { MapboxOverlay } = await import('@deck.gl/mapbox');
    this._deckOverlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
    });
    (this._map as unknown as { addControl(c: IControl): void }).addControl(this._deckOverlay);
  }

  /**
   * Build a geoKeysParser function using geotiff-geokeys-to-proj4.
   * This converts GeoTIFF geokeys to a ProjectionInfo object compatible
   * with @developmentseed/deck.gl-geotiff.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _buildGeoKeysParser(geoKeysToProj4: any): ((geoKeys: Record<string, unknown>) => Promise<{ def: string; parsed: Record<string, unknown>; coordinatesUnits: string } | null>) {
    return async (geoKeys: Record<string, unknown>) => {
      try {
        const result = geoKeysToProj4.toProj4(geoKeys);
        if (result && result.proj4) {
          // Dynamically import proj4 for parsing
          const proj4Module = await import('proj4');
          const proj4Fn = proj4Module.default || proj4Module;
          let parsed: Record<string, unknown> = {};
          if (typeof proj4Fn === 'function') {
            try {
              proj4Fn.defs('custom', result.proj4);
              parsed = proj4Fn.defs('custom') as unknown as Record<string, unknown> || {};
            } catch {
              // ignore proj4 parsing errors
            }
          }
          return {
            def: result.proj4 as string,
            parsed,
            coordinatesUnits: (result.coordinatesUnits as string) || 'metre',
          };
        }
      } catch {
        // Fall back to default parser
      }
      return null;
    };
  }

  private async _addLayer(): Promise<void> {
    if (!this._map || !this._state.url) {
      this._state.error = 'Please enter a COG URL.';
      this._render();
      return;
    }

    this._state.loading = true;
    this._state.error = null;
    this._state.status = null;
    this._render();

    try {
      await this._ensureOverlay();

      const { COGLayer } = await import('@developmentseed/deck.gl-geotiff');

      const map = this._map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layerProps: Record<string, any> = {
        id: 'cog-layer',
        geotiff: this._state.url,
        opacity: this._state.layerOpacity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onGeoTIFFLoad: (_geotiff: any, options: any) => {
          try {
            if (options && options.geographicBounds) {
              const { west, south, east, north } = options.geographicBounds;
              map.fitBounds(
                [[west, south], [east, north]],
                { padding: 50, duration: 1000 }
              );
            }
          } catch {
            // ignore bounds fitting errors
          }
        },
      };

      // Try to use geotiff-geokeys-to-proj4 for better projection support
      try {
        const geokeysModule = await import('geotiff-geokeys-to-proj4');
        const geoKeysToProj4 = geokeysModule.default || geokeysModule;
        if (geoKeysToProj4 && typeof geoKeysToProj4.toProj4 === 'function') {
          layerProps.geoKeysParser = this._buildGeoKeysParser(geoKeysToProj4);
        }
      } catch {
        // geotiff-geokeys-to-proj4 not available, use default parser
      }

      this._COGLayerClass = COGLayer;
      this._cogLayerProps = layerProps;
      this._cogLayer = new COGLayer(layerProps);
      this._deckOverlay.setProps({ layers: [this._cogLayer] });

      this._state.hasLayer = true;
      this._state.loading = false;
      this._state.status = 'COG layer added successfully.';
      this._render();
      this._emit('layeradd', { url: this._state.url });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load COG: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit('error', { error: this._state.error });
    }
  }

  private _updateOpacity(): void {
    if (this._COGLayerClass && this._cogLayerProps && this._deckOverlay) {
      this._cogLayerProps.opacity = this._state.layerOpacity;
      this._cogLayer = new this._COGLayerClass(this._cogLayerProps);
      this._deckOverlay.setProps({ layers: [this._cogLayer] });
    }
  }

  private async _updateLayer(): Promise<void> {
    this._removeLayer();
    await this._addLayer();
    if (this._state.hasLayer) {
      this._emit('layerupdate', { url: this._state.url });
    }
  }

  private _removeLayer(): void {
    if (this._cogLayer && this._deckOverlay) {
      this._deckOverlay.setProps({ layers: [] });
      this._cogLayer = undefined;
      this._cogLayerProps = undefined;
    }
    this._state.hasLayer = false;
    this._state.status = null;
    this._state.error = null;
    this._emit('layerremove');
  }
}
