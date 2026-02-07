import '../styles/common.css';
import '../styles/cog-layer.css';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  CogLayerControlOptions,
  CogLayerControlState,
  CogLayerEvent,
  CogLayerEventHandler,
  CogLayerInfo,
  ColorStop,
  ColormapName,
} from './types';
import { getColormap } from '../colormaps';

/**
 * Shader module that rescales float raster values to [0,1] for visualization.
 * Single-band: maps value from [minVal, maxVal] to grayscale.
 * Multi-band: rescales each channel independently.
 */
const RescaleFloat = {
  name: 'rescaleFloat',
  fs: `\
uniform rescaleFloatUniforms {
  float minVal;
  float maxVal;
  float isSingleBand;
} rescaleFloat;
`,
  inject: {
    'fs:DECKGL_FILTER_COLOR': /* glsl */ `
    float range = rescaleFloat.maxVal - rescaleFloat.minVal;
    if (range > 0.0) {
      if (rescaleFloat.isSingleBand > 0.5) {
        float val = clamp((color.r - rescaleFloat.minVal) / range, 0.0, 1.0);
        color = vec4(val, val, val, 1.0);
      } else {
        color.r = clamp((color.r - rescaleFloat.minVal) / range, 0.0, 1.0);
        color.g = clamp((color.g - rescaleFloat.minVal) / range, 0.0, 1.0);
        color.b = clamp((color.b - rescaleFloat.minVal) / range, 0.0, 1.0);
      }
    }
    `,
  },
  uniformTypes: {
    minVal: 'f32' as const,
    maxVal: 'f32' as const,
    isSingleBand: 'f32' as const,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUniforms: (props: any) => ({
    minVal: props.minVal,
    maxVal: props.maxVal,
    isSingleBand: props.isSingleBand,
  }),
};

/**
 * Recursively apply opacity to deck.gl sublayers via clone().
 * COGLayer doesn't propagate opacity to its RasterLayer/PathLayer sublayers,
 * so this is needed for opacity changes to take visual effect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOpacity(layers: any, opacity: number): any {
  if (!layers) return layers;
  if (Array.isArray(layers)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return layers.map((layer: any) => applyOpacity(layer, opacity));
  }
  if (typeof layers.clone === 'function') {
    return layers.clone({ opacity });
  }
  return layers;
}

/**
 * Parse a CSS hex color (#RGB or #RRGGBB) to [r, g, b] values (0-255).
 */
function parseHexColor(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Build a 256×1 RGBA ImageData from an array of ColorStops.
 * Linearly interpolates between stops.
 */
function colormapToImageData(stops: ColorStop[]): ImageData {
  const size = 256;
  const rgba = new Uint8ClampedArray(size * 4);
  const parsed = stops.map(s => ({ pos: s.position, rgb: parseHexColor(s.color) }));
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    // Find surrounding stops
    let lo = parsed[0], hi = parsed[parsed.length - 1];
    for (let j = 0; j < parsed.length - 1; j++) {
      if (t >= parsed[j].pos && t <= parsed[j + 1].pos) {
        lo = parsed[j];
        hi = parsed[j + 1];
        break;
      }
    }
    const range = hi.pos - lo.pos;
    const f = range > 0 ? (t - lo.pos) / range : 0;
    rgba[i * 4] = lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * f;
    rgba[i * 4 + 1] = lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * f;
    rgba[i * 4 + 2] = lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * f;
    rgba[i * 4 + 3] = 255;
  }
  return new ImageData(rgba, size, 1);
}

/**
 * All available colormap names for the dropdown (sorted alphabetically, 'none' first).
 */
const COLORMAP_NAMES: (ColormapName | 'none')[] = [
  'none',
  ...([
    'bone',
    'bwr',
    'cividis',
    'cool',
    'coolwarm',
    'gray',
    'hot',
    'inferno',
    'jet',
    'magma',
    'ocean',
    'plasma',
    'rainbow',
    'RdBu',
    'RdYlBu',
    'RdYlGn',
    'seismic',
    'spectral',
    'terrain',
    'turbo',
    'viridis',
  ] as ColormapName[]),
];

/**
 * Default options for the CogLayerControl.
 */
const DEFAULT_OPTIONS: Required<CogLayerControlOptions> = {
  position: 'top-right',
  className: '',
  visible: true,
  collapsed: true,
  beforeId: '',
  defaultUrl: '',
  defaultBands: '1',
  defaultColormap: 'none',
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
  private _cogLayers: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cogLayerPropsMap: Map<string, Record<string, any>> = new Map();
  private _layerCounter = 0;
  private _opacityUpdateTimer?: ReturnType<typeof setTimeout>;

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
      layerCount: 0,
      layers: [],
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
    this._removeLayer(); // Remove all layers on cleanup

    // Clear any pending opacity update
    if (this._opacityUpdateTimer) {
      clearTimeout(this._opacityUpdateTimer);
      this._opacityUpdateTimer = undefined;
    }

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
   * Programmatically remove a COG layer by ID, or all layers if no ID given.
   */
  removeLayer(id?: string): void {
    this._removeLayer(id);
    this._render();
  }

  /**
   * Get all COG layer IDs.
   * Useful for adapters and external integrations.
   */
  getLayerIds(): string[] {
    return Array.from(this._cogLayers.keys());
  }

  /**
   * Get the opacity of a specific COG layer.
   * @param layerId The layer ID
   * @returns The opacity value (0-1) or null if layer not found
   */
  getLayerOpacity(layerId: string): number | null {
    const layer = this._cogLayers.get(layerId);
    if (!layer || !layer.props) return null;
    return layer.props.opacity ?? 1;
  }

  /**
   * Set the opacity of a specific COG layer.
   * @param layerId The layer ID
   * @param opacity The opacity value (0-1)
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this._cogLayers.get(layerId);
    if (!layer || typeof layer.clone !== 'function') return;

    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    const updatedLayer = layer.clone({ opacity: clampedOpacity });
    this._cogLayers.set(layerId, updatedLayer);

    // Debounce the overlay update
    if (this._opacityUpdateTimer) {
      clearTimeout(this._opacityUpdateTimer);
    }
    this._opacityUpdateTimer = setTimeout(() => {
      if (this._deckOverlay) {
        this._deckOverlay.setProps({ layers: Array.from(this._cogLayers.values()) });
      }
      if (this._map) {
        this._map.triggerRepaint();
      }
    }, 16);
  }

  /**
   * Get the visibility of a specific COG layer.
   * Visibility is simulated via opacity (opacity > 0 = visible).
   * @param layerId The layer ID
   * @returns true if visible, false otherwise
   */
  getLayerVisibility(layerId: string): boolean {
    const opacity = this.getLayerOpacity(layerId);
    return opacity !== null && opacity > 0;
  }

  /**
   * Set the visibility of a specific COG layer.
   * Visibility is simulated by setting opacity to 0 (hidden) or restoring it (visible).
   * @param layerId The layer ID
   * @param visible Whether the layer should be visible
   * @param storedOpacity Optional opacity to restore when making visible (defaults to 1)
   */
  setLayerVisibility(layerId: string, visible: boolean, storedOpacity: number = 1): void {
    if (visible) {
      this.setLayerOpacity(layerId, storedOpacity);
    } else {
      this.setLayerOpacity(layerId, 0);
    }
  }

  /**
   * Get the URL for a specific COG layer.
   * @param layerId The layer ID
   * @returns The COG URL or null if layer not found
   */
  getLayerUrl(layerId: string): string | null {
    const props = this._cogLayerPropsMap.get(layerId);
    return props?.geotiff as string ?? null;
  }

  private _emit(event: CogLayerEvent, extra?: { url?: string; error?: string; layerId?: string }): void {
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
      opt.textContent = name;
      if (name === this._state.colormap) opt.selected = true;
      cmSelect.appendChild(opt);
    }
    cmSelect.addEventListener('change', () => {
      this._state.colormap = cmSelect.value as ColormapName | 'none';
      this._updateColormapPreview();
    });
    cmGroup.appendChild(cmSelect);

    // Colormap preview
    const cmPreview = document.createElement('div');
    cmPreview.className = 'maplibre-gl-cog-layer-colormap-preview';
    cmPreview.id = 'cog-colormap-preview';
    this._updateColormapPreviewElement(cmPreview);
    cmGroup.appendChild(cmPreview);
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

    // Buttons — always show Add Layer
    const btns = document.createElement('div');
    btns.className = 'maplibre-gl-cog-layer-buttons';

    const addBtn = document.createElement('button');
    addBtn.className = 'maplibre-gl-cog-layer-btn maplibre-gl-cog-layer-btn--primary';
    addBtn.textContent = 'Add Layer';
    addBtn.disabled = this._state.loading;
    addBtn.addEventListener('click', () => this._addLayer());
    btns.appendChild(addBtn);

    panel.appendChild(btns);

    // Status/error area
    if (this._state.loading) {
      this._appendStatus('Loading COG...', 'info');
    } else if (this._state.error) {
      this._appendStatus(this._state.error, 'error');
    } else if (this._state.status) {
      this._appendStatus(this._state.status, 'success');
    }

    // Layer list
    if (this._cogLayers.size > 0) {
      const listContainer = document.createElement('div');
      listContainer.className = 'maplibre-gl-cog-layer-list';

      const listHeader = document.createElement('div');
      listHeader.className = 'maplibre-gl-cog-layer-list-header';
      listHeader.textContent = `Layers (${this._cogLayers.size})`;
      listContainer.appendChild(listHeader);

      for (const [layerId, ] of this._cogLayers) {
        const props = this._cogLayerPropsMap.get(layerId);
        if (!props) continue;

        const item = document.createElement('div');
        item.className = 'maplibre-gl-cog-layer-list-item';

        const label = document.createElement('span');
        label.className = 'maplibre-gl-cog-layer-list-label';
        // Extract filename from URL for display
        const url = props.geotiff as string;
        let displayName: string;
        try {
          const urlObj = new URL(url);
          displayName = urlObj.pathname.split('/').pop() || url;
        } catch {
          displayName = url;
        }
        label.textContent = displayName;
        label.title = url;
        item.appendChild(label);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'maplibre-gl-cog-layer-list-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove layer';
        removeBtn.addEventListener('click', () => {
          this._removeLayer(layerId);
          this._render();
        });
        item.appendChild(removeBtn);

        listContainer.appendChild(item);
      }

      panel.appendChild(listContainer);
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

  private _updateColormapPreview(): void {
    const preview = document.getElementById('cog-colormap-preview');
    if (preview) {
      this._updateColormapPreviewElement(preview);
    }
  }

  private _updateColormapPreviewElement(element: HTMLElement): void {
    if (this._state.colormap === 'none') {
      element.style.background = 'linear-gradient(to right, #888, #888)';
      element.style.display = 'none';
    } else {
      const stops = getColormap(this._state.colormap);
      const colors = stops.map(s => s.color).join(', ');
      element.style.background = `linear-gradient(to right, ${colors})`;
      element.style.display = 'block';
    }
  }

  private async _ensureOverlay(): Promise<void> {
    if (this._deckOverlay) return;
    if (!this._map) return;

    const { MapboxOverlay } = await import('@deck.gl/mapbox');
    // Use interleaved: true to support beforeId for layer ordering
    this._deckOverlay = new MapboxOverlay({
      interleaved: true,
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

  /**
   * Monkey-patch COGLayer._parseGeoTIFF to handle floating-point GeoTIFFs.
   * The upstream library only supports unsigned integer data (SampleFormat: 1).
   * This patch catches the "non-unsigned integers not yet supported" error and
   * re-implements the parsing with a float-compatible render pipeline.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _patchCOGLayerForFloat(COGLayerClass: any): void {
    // Guard: only patch once
    if (COGLayerClass.__floatPatched) return;
    COGLayerClass.__floatPatched = true;

    const originalParseGeoTIFF = COGLayerClass.prototype._parseGeoTIFF;

    COGLayerClass.prototype._parseGeoTIFF = async function () {
      try {
        await originalParseGeoTIFF.call(this);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('non-unsigned integers not yet supported')) {
          throw err;
        }

        // Float fallback: re-do the GeoTIFF parsing with a custom pipeline.
        // We use the public exports from the library plus `geotiff` (transitive dep).
        const { fromUrl } = await import('geotiff');
        const { parseCOGTileMatrixSet, texture } = await import(
          '@developmentseed/deck.gl-geotiff'
        );
        const { CreateTexture, FilterNoDataVal } = await import(
          '@developmentseed/deck.gl-raster/gpu-modules'
        );
        const proj4Module = await import('proj4');
        const proj4Fn = proj4Module.default || proj4Module;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geotiffInput = (this as any).props.geotiff;
        const geotiff = typeof geotiffInput === 'string'
          ? await fromUrl(geotiffInput)
          : geotiffInput;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoKeysParser = (this as any).props.geoKeysParser;
        const metadata = await parseCOGTileMatrixSet(geotiff, geoKeysParser);

        const image = await geotiff.getImage();
        const imageCount = await geotiff.getImageCount();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const images: any[] = [];
        for (let i = 0; i < imageCount; i++) {
          images.push(await geotiff.getImage(i));
        }

        const sourceProjection = await geoKeysParser(image.getGeoKeys());
        if (!sourceProjection) {
          throw new Error('Could not determine source projection from GeoTIFF geo keys');
        }
        const converter = proj4Fn(sourceProjection.def, 'EPSG:4326');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const forwardReproject = (x: number, y: number) => converter.forward([x, y], false as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inverseReproject = (x: number, y: number) => converter.inverse([x, y], false as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((this as any).props.onGeoTIFFLoad) {
          // Compute geographic bounds for fitBounds callback
          const bbox = image.getBoundingBox();
          const corners = [
            converter.forward([bbox[0], bbox[1]]),
            converter.forward([bbox[2], bbox[1]]),
            converter.forward([bbox[2], bbox[3]]),
            converter.forward([bbox[0], bbox[3]]),
          ];
          const lons = corners.map((c: number[]) => c[0]);
          const lats = corners.map((c: number[]) => c[1]);
          const geographicBounds = {
            west: Math.min(...lons),
            south: Math.min(...lats),
            east: Math.max(...lons),
            north: Math.max(...lats),
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any).props.onGeoTIFFLoad(geotiff, {
            projection: sourceProjection,
            geographicBounds,
          });
        }

        // Build float-compatible getTileData and renderTile
        const ifd = image.getFileDirectory();
        const { BitsPerSample, SampleFormat, SamplesPerPixel, GDAL_NODATA } = ifd;

        // Parse GDAL_NODATA tag (inline, since it's not publicly exported)
        let noDataVal: number | null = null;
        if (GDAL_NODATA) {
          const ndStr = GDAL_NODATA[GDAL_NODATA.length - 1] === '\x00'
            ? GDAL_NODATA.slice(0, -1)
            : GDAL_NODATA;
          if (ndStr.length > 0) noDataVal = parseFloat(ndStr);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const defaultGetTileData = async (geotiffImage: any, options: any) => {
          const { device } = options;
          const rasterData = await geotiffImage.readRasters({
            ...options,
            interleave: true,
          });

          let data = rasterData;
          let numSamples = SamplesPerPixel;

          // WebGL2 has no RGB-only float format; expand 3-band to RGBA
          if (SamplesPerPixel === 3) {
            const pixelCount = rasterData.width * rasterData.height;
            const rgba = new Float32Array(pixelCount * 4);
            for (let i = 0; i < pixelCount; i++) {
              rgba[i * 4] = rasterData[i * 3];
              rgba[i * 4 + 1] = rasterData[i * 3 + 1];
              rgba[i * 4 + 2] = rasterData[i * 3 + 2];
              rgba[i * 4 + 3] = 1.0;
            }
            data = rgba;
            // Preserve dimensions for texture creation
            (data as { width?: number; height?: number }).width = rasterData.width;
            (data as { width?: number; height?: number }).height = rasterData.height;
            numSamples = 4;
          }

          const textureFormat = texture.inferTextureFormat(numSamples, BitsPerSample, SampleFormat);
          const tex = device.createTexture({
            data,
            format: textureFormat,
            width: rasterData.width,
            height: rasterData.height,
            sampler: { magFilter: 'nearest', minFilter: 'nearest' },
          });

          return {
            texture: tex,
            height: rasterData.height,
            width: rasterData.width,
          };
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        // Cache colormap texture to avoid recreating per tile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cachedCmapName: string | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cachedCmapTexture: any = null;

        const { Colormap } = await import('@developmentseed/deck.gl-raster/gpu-modules');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const defaultRenderTile = (tileData: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pipeline: any[] = [
            {
              module: CreateTexture,
              props: { textureName: tileData.texture },
            },
          ];

          // Filter nodata pixels
          if (noDataVal !== null) {
            pipeline.push({
              module: FilterNoDataVal,
              props: { value: noDataVal },
            });
          }

          // Rescale float values to [0,1] for visualization
          const rescaleMin = self.props._rescaleMin ?? 0;
          const rescaleMax = self.props._rescaleMax ?? 255;
          pipeline.push({
            module: RescaleFloat,
            props: {
              minVal: rescaleMin,
              maxVal: rescaleMax,
              isSingleBand: SamplesPerPixel === 1 ? 1.0 : 0.0,
            },
          });

          // Apply colormap if selected
          const cmapName = self.props._colormap;
          if (cmapName && cmapName !== 'none') {
            if (cmapName !== cachedCmapName) {
              const stops = getColormap(cmapName);
              const imageData = colormapToImageData(stops);
              cachedCmapTexture = self.context.device.createTexture({
                data: imageData.data,
                format: 'rgba8unorm',
                width: imageData.width,
                height: imageData.height,
                sampler: {
                  minFilter: 'linear',
                  magFilter: 'linear',
                  addressModeU: 'clamp-to-edge',
                  addressModeV: 'clamp-to-edge',
                },
              });
              cachedCmapName = cmapName;
            }
            pipeline.push({
              module: Colormap,
              props: { colormapTexture: cachedCmapTexture },
            });
          }

          return pipeline;
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).setState({
          metadata,
          forwardReproject,
          inverseReproject,
          images,
          defaultGetTileData,
          defaultRenderTile,
        });
      }
    };
  }

  /**
   * Monkey-patch COGLayer._renderSubLayers to propagate opacity to sublayers.
   * The upstream COGLayer doesn't pass opacity to its RasterLayer/PathLayer
   * sublayers, so opacity changes have no visual effect without this patch.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _patchCOGLayerForOpacity(COGLayerClass: any): void {
    if (COGLayerClass.__opacityPatched) return;
    COGLayerClass.__opacityPatched = true;

    const originalRenderSubLayers = COGLayerClass.prototype._renderSubLayers;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    COGLayerClass.prototype._renderSubLayers = function (...args: any[]) {
      const layers = originalRenderSubLayers.apply(this, args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opacity = (this as any).props.opacity;
      if (opacity === undefined || opacity === null) return layers;
      return applyOpacity(layers, Math.max(0, Math.min(1, opacity)));
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

      // Patch COGLayer to support floating-point GeoTIFFs and opacity
      this._patchCOGLayerForFloat(COGLayer);
      this._patchCOGLayerForOpacity(COGLayer);

      const map = this._map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layerProps: Record<string, any> = {
        geotiff: this._state.url,
        opacity: this._state.layerOpacity,
        _rescaleMin: this._state.rescaleMin,
        _rescaleMax: this._state.rescaleMax,
        _colormap: this._state.colormap,
        // Add beforeId for layer ordering (only if specified)
        ...(this._options.beforeId ? { beforeId: this._options.beforeId } : {}),
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

      // Generate unique layer ID
      const layerId = `cog-layer-${this._layerCounter++}`;
      layerProps.id = layerId;

      this._cogLayerPropsMap.set(layerId, layerProps);
      const newLayer = new COGLayer(layerProps);
      this._cogLayers.set(layerId, newLayer);
      this._deckOverlay.setProps({ layers: Array.from(this._cogLayers.values()) });

      this._state.hasLayer = this._cogLayers.size > 0;
      this._state.layerCount = this._cogLayers.size;
      this._state.layers = this._buildLayerInfoList();
      this._state.loading = false;
      this._state.status = 'COG layer added successfully.';
      this._render();
      this._emit('layeradd', { url: this._state.url, layerId });
    } catch (err) {
      this._state.loading = false;
      this._state.error = `Failed to load COG: ${err instanceof Error ? err.message : String(err)}`;
      this._render();
      this._emit('error', { error: this._state.error });
    }
  }

  private _removeLayer(id?: string): void {
    if (id) {
      // Remove a specific layer
      this._cogLayers.delete(id);
      this._cogLayerPropsMap.delete(id);
      if (this._deckOverlay) {
        this._deckOverlay.setProps({ layers: Array.from(this._cogLayers.values()) });
      }
      this._state.hasLayer = this._cogLayers.size > 0;
      this._state.layerCount = this._cogLayers.size;
      this._state.layers = this._buildLayerInfoList();
      this._state.status = null;
      this._state.error = null;
      this._emit('layerremove', { layerId: id });
    } else {
      // Remove all layers (cleanup)
      if (this._deckOverlay) {
        this._deckOverlay.setProps({ layers: [] });
      }
      this._cogLayers.clear();
      this._cogLayerPropsMap.clear();
      this._state.hasLayer = false;
      this._state.layerCount = 0;
      this._state.layers = [];
      this._state.status = null;
      this._state.error = null;
      this._emit('layerremove');
    }
  }

  private _updateOpacity(): void {
    // Debounce opacity updates since deck.gl layer cloning is expensive
    if (this._opacityUpdateTimer) {
      clearTimeout(this._opacityUpdateTimer);
    }
    this._opacityUpdateTimer = setTimeout(() => {
      this._applyOpacity();
    }, 16); // ~60fps, avoids lag while still being responsive
  }

  private _applyOpacity(): void {
    if (!this._deckOverlay || this._cogLayers.size === 0) return;
    const opacity = this._state.layerOpacity;
    // deck.gl layers are immutable; clone each with the new opacity
    for (const [id, layer] of this._cogLayers) {
      if (typeof layer.clone === 'function') {
        this._cogLayers.set(id, layer.clone({ opacity }));
      }
    }
    this._deckOverlay.setProps({ layers: Array.from(this._cogLayers.values()) });
    if (this._map) {
      this._map.triggerRepaint();
    }
  }

  private _buildLayerInfoList(): CogLayerInfo[] {
    const list: CogLayerInfo[] = [];
    for (const [layerId, props] of this._cogLayerPropsMap) {
      list.push({
        id: layerId,
        url: props.geotiff as string,
        bands: '1', // bands are baked into COGLayer at creation
        colormap: (props._colormap as ColormapName | 'none') || 'none',
        rescaleMin: (props._rescaleMin as number) ?? 0,
        rescaleMax: (props._rescaleMax as number) ?? 255,
        nodata: undefined,
        opacity: (props.opacity as number) ?? 1,
      });
    }
    return list;
  }
}
