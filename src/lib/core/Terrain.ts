import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  TerrainControlOptions,
  TerrainControlState,
  TerrainEvent,
  TerrainEventHandler,
} from './types';

/**
 * AWS Terrarium terrain tiles URL.
 */
const DEFAULT_TERRAIN_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/**
 * Unique source ID for terrain DEM.
 */
const TERRAIN_SOURCE_ID = 'maplibre-gl-terrain-dem';

/**
 * Unique layer ID for hillshade.
 */
const HILLSHADE_LAYER_ID = 'maplibre-gl-terrain-hillshade';

/**
 * Default options for the TerrainControl.
 */
const DEFAULT_OPTIONS: Required<TerrainControlOptions> = {
  sourceUrl: DEFAULT_TERRAIN_URL,
  encoding: 'terrarium',
  exaggeration: 1.0,
  enabled: false,
  hillshade: true,
  hillshadeExaggeration: 0.5,
  sourceMinzoom: 0,
  sourceMaxzoom: 15,
  tileSize: 256,
  position: 'top-right',
  className: '',
  visible: true,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: 4,
  opacity: 1,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * Mountain icon SVG for the terrain toggle button.
 */
const TERRAIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;

/**
 * A terrain toggle control for MapLibre GL maps.
 *
 * Enables/disables 3D terrain rendering using AWS Terrarium elevation tiles.
 *
 * @example
 * ```typescript
 * const terrain = new TerrainControl({
 *   exaggeration: 1.5,
 *   hillshade: true,
 * });
 * map.addControl(terrain, 'top-right');
 *
 * terrain.on('terrainchange', (event) => {
 *   console.log('Terrain enabled:', event.state.enabled);
 * });
 * ```
 */
export class TerrainControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _options: Required<TerrainControlOptions>;
  private _state: TerrainControlState;
  private _eventHandlers: Map<TerrainEvent, Set<TerrainEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _handleStyleLoad?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new TerrainControl instance.
   *
   * @param options - Configuration options for the terrain control.
   */
  constructor(options?: TerrainControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      enabled: this._options.enabled,
      exaggeration: this._options.exaggeration,
      hillshade: this._options.hillshade,
    };
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
    this._render();

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on('zoom', this._handleZoom);

    // Handle style changes (e.g., when basemap changes)
    this._handleStyleLoad = () => {
      if (this._state.enabled) {
        // Re-apply terrain after style change
        this._setupTerrain();
      }
    };
    this._map.on('style.load', this._handleStyleLoad);

    // Check initial zoom
    this._checkZoomVisibility();

    // Enable terrain if default enabled
    if (this._options.enabled) {
      // Wait for map to be ready
      if (this._map.isStyleLoaded()) {
        this._setupTerrain();
      } else {
        this._map.once('load', () => this._setupTerrain());
      }
    }

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    // Remove terrain and hillshade
    this._removeTerrain();

    // Remove event listeners
    if (this._map && this._handleZoom) {
      this._map.off('zoom', this._handleZoom);
      this._handleZoom = undefined;
    }
    if (this._map && this._handleStyleLoad) {
      this._map.off('style.load', this._handleStyleLoad);
      this._handleStyleLoad = undefined;
    }

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._eventHandlers.clear();
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
   * Enables terrain rendering.
   */
  enable(): void {
    if (!this._state.enabled) {
      this._setupTerrain();
      this._render();
      this._emit('terrainchange');
      this._emit('update');
    }
  }

  /**
   * Disables terrain rendering.
   */
  disable(): void {
    if (this._state.enabled) {
      this._removeTerrain();
      this._render();
      this._emit('terrainchange');
      this._emit('update');
    }
  }

  /**
   * Toggles terrain on/off.
   */
  toggle(): void {
    if (this._state.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Checks if terrain is currently enabled.
   *
   * @returns True if terrain is enabled.
   */
  isEnabled(): boolean {
    return this._state.enabled;
  }

  /**
   * Sets the terrain exaggeration factor.
   *
   * @param value - Exaggeration value (typically 0.1 to 10.0).
   */
  setExaggeration(value: number): void {
    const clampedValue = Math.max(0.1, Math.min(10, value));
    this._state.exaggeration = clampedValue;
    this._options.exaggeration = clampedValue;

    if (this._map && this._state.enabled) {
      this._map.setTerrain({
        source: TERRAIN_SOURCE_ID,
        exaggeration: clampedValue,
      });
    }

    this._emit('update');
  }

  /**
   * Gets the current exaggeration value.
   *
   * @returns The current exaggeration factor.
   */
  getExaggeration(): number {
    return this._state.exaggeration;
  }

  /**
   * Enables the hillshade layer.
   */
  enableHillshade(): void {
    if (!this._state.hillshade) {
      this._state.hillshade = true;
      this._options.hillshade = true;
      if (this._state.enabled) {
        this._addHillshadeLayer();
      }
      this._emit('update');
    }
  }

  /**
   * Disables the hillshade layer.
   */
  disableHillshade(): void {
    if (this._state.hillshade) {
      this._state.hillshade = false;
      this._options.hillshade = false;
      this._removeHillshadeLayer();
      this._emit('update');
    }
  }

  /**
   * Toggles the hillshade layer.
   */
  toggleHillshade(): void {
    if (this._state.hillshade) {
      this.disableHillshade();
    } else {
      this.enableHillshade();
    }
  }

  /**
   * Updates control options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<TerrainControlOptions>): void {
    const prevEnabled = this._state.enabled;

    this._options = { ...this._options, ...options };

    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.enabled !== undefined) this._state.enabled = options.enabled;
    if (options.exaggeration !== undefined) {
      this._state.exaggeration = options.exaggeration;
    }
    if (options.hillshade !== undefined) this._state.hillshade = options.hillshade;

    // Handle terrain enable/disable
    if (options.enabled !== undefined && options.enabled !== prevEnabled) {
      if (options.enabled) {
        this._setupTerrain();
      } else {
        this._removeTerrain();
      }
    } else if (this._state.enabled && options.exaggeration !== undefined) {
      // Update exaggeration if terrain is already enabled
      this.setExaggeration(options.exaggeration);
    }

    this._render();
    this._emit('update');
  }

  /**
   * Gets the current state.
   *
   * @returns The current terrain control state.
   */
  getState(): TerrainControlState {
    return { ...this._state };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: TerrainEvent, handler: TerrainEventHandler): void {
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
  off(event: TerrainEvent, handler: TerrainEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emits an event to all registered handlers.
   *
   * @param event - The event type to emit.
   */
  private _emit(event: TerrainEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState() };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Sets up the terrain source and enables terrain rendering.
   */
  private _setupTerrain(): void {
    if (!this._map) return;

    try {
      // Add raster-dem source if not already present
      if (!this._map.getSource(TERRAIN_SOURCE_ID)) {
        this._map.addSource(TERRAIN_SOURCE_ID, {
          type: 'raster-dem',
          tiles: [this._options.sourceUrl],
          encoding: this._options.encoding,
          tileSize: this._options.tileSize,
          minzoom: this._options.sourceMinzoom,
          maxzoom: this._options.sourceMaxzoom,
        });
      }

      // Enable terrain on the map
      this._map.setTerrain({
        source: TERRAIN_SOURCE_ID,
        exaggeration: this._state.exaggeration,
      });

      // Add hillshade if enabled
      if (this._state.hillshade) {
        this._addHillshadeLayer();
      }

      this._state.enabled = true;
    } catch (error) {
      console.error('Failed to setup terrain:', error);
    }
  }

  /**
   * Removes terrain and cleans up sources/layers.
   */
  private _removeTerrain(): void {
    if (!this._map) return;

    try {
      // Disable terrain
      this._map.setTerrain(null);

      // Remove hillshade layer
      this._removeHillshadeLayer();

      // Remove source
      if (this._map.getSource(TERRAIN_SOURCE_ID)) {
        this._map.removeSource(TERRAIN_SOURCE_ID);
      }

      this._state.enabled = false;
    } catch (error) {
      console.error('Failed to remove terrain:', error);
    }
  }

  /**
   * Adds the hillshade layer for better terrain visualization.
   */
  private _addHillshadeLayer(): void {
    if (!this._map || this._map.getLayer(HILLSHADE_LAYER_ID)) return;

    try {
      // Find the first symbol layer to insert hillshade below labels
      const layers = this._map.getStyle().layers || [];
      let firstSymbolId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      this._map.addLayer(
        {
          id: HILLSHADE_LAYER_ID,
          type: 'hillshade',
          source: TERRAIN_SOURCE_ID,
          paint: {
            'hillshade-exaggeration': this._options.hillshadeExaggeration,
          },
        },
        firstSymbolId
      );
    } catch (error) {
      console.error('Failed to add hillshade layer:', error);
    }
  }

  /**
   * Removes the hillshade layer.
   */
  private _removeHillshadeLayer(): void {
    if (!this._map) return;

    try {
      if (this._map.getLayer(HILLSHADE_LAYER_ID)) {
        this._map.removeLayer(HILLSHADE_LAYER_ID);
      }
    } catch (error) {
      console.error('Failed to remove hillshade layer:', error);
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
    this._container.style.display = shouldShow ? 'flex' : 'none';
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-terrain${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = 'none';
    }

    // Apply custom styles
    if (this._options.backgroundColor) {
      container.style.backgroundColor = this._options.backgroundColor;
    }
    if (this._options.borderRadius) {
      container.style.borderRadius = `${this._options.borderRadius}px`;
    }
    if (this._options.opacity !== 1) {
      container.style.opacity = String(this._options.opacity);
    }

    // Create button
    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'maplibre-gl-terrain-button';
    this._button.title = 'Toggle terrain';
    this._button.setAttribute('aria-label', 'Toggle terrain');
    this._button.innerHTML = TERRAIN_ICON;

    this._button.addEventListener('click', () => this.toggle());

    container.appendChild(this._button);

    return container;
  }

  /**
   * Renders/updates the control appearance based on current state.
   */
  private _render(): void {
    if (!this._button) return;

    // Update button active state
    if (this._state.enabled) {
      this._button.classList.add('maplibre-gl-terrain-button--active');
      this._button.title = 'Disable terrain';
      this._button.setAttribute('aria-label', 'Disable terrain');
    } else {
      this._button.classList.remove('maplibre-gl-terrain-button--active');
      this._button.title = 'Enable terrain';
      this._button.setAttribute('aria-label', 'Enable terrain');
    }

    this._updateDisplayState();
  }
}
