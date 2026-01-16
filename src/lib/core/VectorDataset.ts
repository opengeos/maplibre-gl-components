import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  VectorDatasetControlOptions,
  VectorDatasetControlState,
  VectorDatasetEvent,
  VectorDatasetEventHandler,
  LoadedDataset,
  VectorLayerStyle,
} from './types';
import { generateId } from '../utils/helpers';

/**
 * Default style for vector layers.
 */
const DEFAULT_STYLE: Required<VectorLayerStyle> = {
  fillColor: '#3388ff',
  fillOpacity: 0.3,
  strokeColor: '#3388ff',
  strokeWidth: 2,
  strokeOpacity: 1,
  circleRadius: 6,
  circleColor: '#3388ff',
  circleStrokeColor: '#ffffff',
  circleStrokeWidth: 2,
};

/**
 * Default options for the VectorDatasetControl.
 */
const DEFAULT_OPTIONS: Required<VectorDatasetControlOptions> = {
  position: 'top-right',
  className: '',
  visible: true,
  showDropZone: true,
  acceptedExtensions: ['.geojson', '.json'],
  multiple: true,
  defaultStyle: DEFAULT_STYLE,
  fitBounds: true,
  fitBoundsPadding: 50,
  maxFileSize: 52428800, // 50MB
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: 4,
  opacity: 1,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * Upload icon SVG for the button.
 */
const UPLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

/**
 * A vector dataset upload control for MapLibre GL maps.
 *
 * Enables loading GeoJSON files via file upload button or drag-and-drop.
 *
 * @example
 * ```typescript
 * const vectorControl = new VectorDatasetControl({
 *   fitBounds: true,
 *   defaultStyle: {
 *     fillColor: '#ff0000',
 *     fillOpacity: 0.5,
 *   },
 * });
 * map.addControl(vectorControl, 'top-right');
 *
 * vectorControl.on('load', (event) => {
 *   console.log('Loaded dataset:', event.dataset?.filename);
 * });
 * ```
 */
export class VectorDatasetControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _fileInput?: HTMLInputElement;
  private _dropZone?: HTMLElement;
  private _options: Required<VectorDatasetControlOptions>;
  private _state: VectorDatasetControlState;
  private _eventHandlers: Map<VectorDatasetEvent, Set<VectorDatasetEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _boundDragOver?: (e: DragEvent) => void;
  private _boundDragLeave?: (e: DragEvent) => void;
  private _boundDrop?: (e: DragEvent) => void;

  /**
   * Creates a new VectorDatasetControl instance.
   *
   * @param options - Configuration options for the vector dataset control.
   */
  constructor(options?: VectorDatasetControlOptions) {
    this._options = {
      ...DEFAULT_OPTIONS,
      ...options,
      defaultStyle: { ...DEFAULT_STYLE, ...options?.defaultStyle },
    };
    this._state = {
      visible: this._options.visible,
      isDragging: false,
      isLoading: false,
      loadedDatasets: [],
      error: null,
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

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on('zoom', this._handleZoom);

    // Set up drag-and-drop on the map container
    if (this._options.showDropZone) {
      this._setupDragAndDrop();
    }

    this._checkZoomVisibility();

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    // Remove drag-and-drop listeners
    this._removeDragAndDrop();

    // Remove all loaded sources and layers
    this._removeAllDatasets();

    // Remove zoom listener
    if (this._map && this._handleZoom) {
      this._map.off('zoom', this._handleZoom);
      this._handleZoom = undefined;
    }

    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._button = undefined;
    this._fileInput = undefined;
    this._dropZone = undefined;
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
   * Gets the current state.
   *
   * @returns The current vector dataset control state.
   */
  getState(): VectorDatasetControlState {
    return { ...this._state, loadedDatasets: [...this._state.loadedDatasets] };
  }

  /**
   * Gets all loaded datasets.
   *
   * @returns Array of loaded datasets.
   */
  getLoadedDatasets(): LoadedDataset[] {
    return [...this._state.loadedDatasets];
  }

  /**
   * Removes a dataset by ID.
   *
   * @param datasetId - The ID of the dataset to remove.
   */
  removeDataset(datasetId: string): void {
    const dataset = this._state.loadedDatasets.find((d) => d.id === datasetId);
    if (!dataset || !this._map) return;

    try {
      // Remove layers first
      for (const layerId of dataset.layerIds) {
        if (this._map.getLayer(layerId)) {
          this._map.removeLayer(layerId);
        }
      }

      // Remove source
      if (this._map.getSource(dataset.sourceId)) {
        this._map.removeSource(dataset.sourceId);
      }

      // Update state
      this._state.loadedDatasets = this._state.loadedDatasets.filter((d) => d.id !== datasetId);
      this._emit('update');
    } catch (error) {
      console.error('Failed to remove dataset:', error);
    }
  }

  /**
   * Removes all loaded datasets.
   */
  removeAllDatasets(): void {
    this._removeAllDatasets();
    this._emit('update');
  }

  /**
   * Programmatically loads a GeoJSON object.
   *
   * @param geojson - The GeoJSON object to load.
   * @param filename - Optional filename for the dataset.
   * @returns The loaded dataset or null if failed.
   */
  async loadGeoJSON(
    geojson: GeoJSON.GeoJSON,
    filename: string = 'data.geojson'
  ): Promise<LoadedDataset | null> {
    return this._processGeoJSON(geojson, filename);
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: VectorDatasetEvent, handler: VectorDatasetEventHandler): void {
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
  off(event: VectorDatasetEvent, handler: VectorDatasetEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Updates control options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<VectorDatasetControlOptions>): void {
    this._options = {
      ...this._options,
      ...options,
      defaultStyle: { ...this._options.defaultStyle, ...options?.defaultStyle },
    };

    if (options.visible !== undefined) {
      this._state.visible = options.visible;
    }

    this._updateDisplayState();
    this._emit('update');
  }

  /**
   * Emits an event to all registered handlers.
   *
   * @param event - The event type to emit.
   * @param dataset - Optional dataset for load events.
   * @param error - Optional error message for error events.
   * @param filename - Optional filename for error events.
   */
  private _emit(
    event: VectorDatasetEvent,
    dataset?: LoadedDataset,
    error?: string,
    filename?: string
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = {
        type: event,
        state: this.getState(),
        dataset,
        error,
        filename,
      };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-vector-dataset${
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

    // Create hidden file input
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = this._options.acceptedExtensions.join(',');
    this._fileInput.multiple = this._options.multiple;
    this._fileInput.style.display = 'none';
    this._fileInput.addEventListener('change', (e) => this._handleFileSelect(e));
    container.appendChild(this._fileInput);

    // Create button
    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'maplibre-gl-vector-dataset-button';
    this._button.title = 'Load GeoJSON file';
    this._button.setAttribute('aria-label', 'Load GeoJSON file');
    this._button.innerHTML = UPLOAD_ICON;
    this._button.addEventListener('click', () => this._fileInput?.click());
    container.appendChild(this._button);

    return container;
  }

  /**
   * Sets up drag-and-drop event listeners on the map container.
   */
  private _setupDragAndDrop(): void {
    if (!this._map) return;

    const mapContainer = this._map.getContainer();

    // Create drop zone overlay
    this._dropZone = document.createElement('div');
    this._dropZone.className = 'maplibre-gl-vector-dataset-dropzone';
    this._dropZone.innerHTML = `
      <div class="maplibre-gl-vector-dataset-dropzone-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop GeoJSON files here</p>
      </div>
    `;
    this._dropZone.style.display = 'none';
    mapContainer.appendChild(this._dropZone);

    // Bind event handlers
    this._boundDragOver = (e: DragEvent) => this._handleDragOver(e);
    this._boundDragLeave = (e: DragEvent) => this._handleDragLeave(e);
    this._boundDrop = (e: DragEvent) => this._handleDrop(e);

    mapContainer.addEventListener('dragover', this._boundDragOver);
    mapContainer.addEventListener('dragleave', this._boundDragLeave);
    mapContainer.addEventListener('drop', this._boundDrop);
  }

  /**
   * Removes drag-and-drop event listeners.
   */
  private _removeDragAndDrop(): void {
    if (!this._map) return;

    const mapContainer = this._map.getContainer();

    if (this._boundDragOver) {
      mapContainer.removeEventListener('dragover', this._boundDragOver);
    }
    if (this._boundDragLeave) {
      mapContainer.removeEventListener('dragleave', this._boundDragLeave);
    }
    if (this._boundDrop) {
      mapContainer.removeEventListener('drop', this._boundDrop);
    }

    if (this._dropZone && this._dropZone.parentNode) {
      this._dropZone.parentNode.removeChild(this._dropZone);
    }
  }

  /**
   * Handles dragover event.
   *
   * @param e - The drag event.
   */
  private _handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (!this._state.isDragging) {
      this._state.isDragging = true;
      if (this._dropZone) {
        this._dropZone.style.display = 'flex';
      }
      this._emit('dragenter');
    }
  }

  /**
   * Handles dragleave event.
   *
   * @param e - The drag event.
   */
  private _handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Check if we're leaving the map container entirely
    const mapContainer = this._map?.getContainer();
    if (mapContainer && !mapContainer.contains(e.relatedTarget as Node)) {
      this._state.isDragging = false;
      if (this._dropZone) {
        this._dropZone.style.display = 'none';
      }
      this._emit('dragleave');
    }
  }

  /**
   * Handles drop event.
   *
   * @param e - The drag event.
   */
  private _handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    this._state.isDragging = false;
    if (this._dropZone) {
      this._dropZone.style.display = 'none';
    }

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this._processFiles(Array.from(files));
    }
  }

  /**
   * Handles file input change event.
   *
   * @param e - The change event.
   */
  private _handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this._processFiles(Array.from(files));
    }
    // Reset input to allow selecting the same file again
    input.value = '';
  }

  /**
   * Processes uploaded files.
   *
   * @param files - Array of files to process.
   */
  private async _processFiles(files: File[]): Promise<void> {
    this._state.isLoading = true;
    this._state.error = null;
    this._updateButtonState();

    for (const file of files) {
      // Validate file extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!this._options.acceptedExtensions.includes(ext)) {
        this._state.error = `Invalid file type: ${file.name}. Accepted: ${this._options.acceptedExtensions.join(', ')}`;
        this._emit('error', undefined, this._state.error, file.name);
        continue;
      }

      // Validate file size
      if (file.size > this._options.maxFileSize) {
        const maxSizeMB = (this._options.maxFileSize / (1024 * 1024)).toFixed(1);
        this._state.error = `File too large: ${file.name}. Maximum size: ${maxSizeMB}MB`;
        this._emit('error', undefined, this._state.error, file.name);
        continue;
      }

      try {
        const text = await file.text();
        const geojson = JSON.parse(text) as GeoJSON.GeoJSON;
        await this._processGeoJSON(geojson, file.name);
      } catch (error) {
        this._state.error = `Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`;
        this._emit('error', undefined, this._state.error, file.name);
      }
    }

    this._state.isLoading = false;
    this._updateButtonState();
  }

  /**
   * Processes a GeoJSON object and adds it to the map.
   *
   * @param geojson - The GeoJSON object to process.
   * @param filename - The filename of the dataset.
   * @returns The loaded dataset or null if failed.
   */
  private async _processGeoJSON(
    geojson: GeoJSON.GeoJSON,
    filename: string
  ): Promise<LoadedDataset | null> {
    if (!this._map) return null;

    // Validate GeoJSON structure
    if (!geojson.type) {
      this._state.error = `Invalid GeoJSON: missing type property in ${filename}`;
      this._emit('error', undefined, this._state.error, filename);
      return null;
    }

    // Normalize to FeatureCollection
    let featureCollection: GeoJSON.FeatureCollection;
    if (geojson.type === 'FeatureCollection') {
      featureCollection = geojson as GeoJSON.FeatureCollection;
    } else if (geojson.type === 'Feature') {
      featureCollection = {
        type: 'FeatureCollection',
        features: [geojson as GeoJSON.Feature],
      };
    } else {
      // It's a geometry object
      featureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: geojson as GeoJSON.Geometry,
          },
        ],
      };
    }

    // Generate unique IDs
    const datasetId = generateId('vds');
    const sourceId = `${datasetId}-source`;

    // Analyze geometry types
    const geometryTypes = new Set<string>();
    for (const feature of featureCollection.features) {
      if (feature.geometry) {
        geometryTypes.add(feature.geometry.type);
      }
    }

    try {
      // Add source
      this._map.addSource(sourceId, {
        type: 'geojson',
        data: featureCollection,
        generateId: true,
      });

      // Add layers based on geometry types
      const layerIds: string[] = [];
      const style = this._options.defaultStyle;

      // Add polygon fill layer
      if (geometryTypes.has('Polygon') || geometryTypes.has('MultiPolygon')) {
        const fillLayerId = `${datasetId}-fill`;
        this._map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          filter: [
            'any',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['geometry-type'], 'MultiPolygon'],
          ],
          paint: {
            'fill-color': style.fillColor,
            'fill-opacity': style.fillOpacity,
          },
        });
        layerIds.push(fillLayerId);

        // Add polygon outline
        const outlineLayerId = `${datasetId}-outline`;
        this._map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          filter: [
            'any',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['geometry-type'], 'MultiPolygon'],
          ],
          paint: {
            'line-color': style.strokeColor,
            'line-width': style.strokeWidth,
            'line-opacity': style.strokeOpacity,
          },
        });
        layerIds.push(outlineLayerId);
      }

      // Add line layer
      if (geometryTypes.has('LineString') || geometryTypes.has('MultiLineString')) {
        const lineLayerId = `${datasetId}-line`;
        this._map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          filter: [
            'any',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['geometry-type'], 'MultiLineString'],
          ],
          paint: {
            'line-color': style.strokeColor,
            'line-width': style.strokeWidth,
            'line-opacity': style.strokeOpacity,
          },
        });
        layerIds.push(lineLayerId);
      }

      // Add point layer
      if (geometryTypes.has('Point') || geometryTypes.has('MultiPoint')) {
        const pointLayerId = `${datasetId}-point`;
        this._map.addLayer({
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
          filter: [
            'any',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['geometry-type'], 'MultiPoint'],
          ],
          paint: {
            'circle-radius': style.circleRadius,
            'circle-color': style.circleColor,
            'circle-stroke-color': style.circleStrokeColor,
            'circle-stroke-width': style.circleStrokeWidth,
          },
        });
        layerIds.push(pointLayerId);
      }

      // Create dataset record
      const dataset: LoadedDataset = {
        id: datasetId,
        filename,
        sourceId,
        layerIds,
        featureCount: featureCollection.features.length,
        geometryTypes: Array.from(geometryTypes) as LoadedDataset['geometryTypes'],
        loadedAt: new Date(),
      };

      this._state.loadedDatasets.push(dataset);

      // Fit bounds if enabled
      if (this._options.fitBounds && featureCollection.features.length > 0) {
        this._fitToData(featureCollection);
      }

      this._emit('load', dataset);
      this._emit('update');

      return dataset;
    } catch (error) {
      this._state.error = `Failed to add ${filename} to map: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this._emit('error', undefined, this._state.error, filename);
      return null;
    }
  }

  /**
   * Fits the map view to the loaded data bounds.
   *
   * @param geojson - The GeoJSON FeatureCollection to fit to.
   */
  private _fitToData(geojson: GeoJSON.FeatureCollection): void {
    if (!this._map) return;

    // Calculate bounds from all features
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;

    const processCoords = (coords: number[]) => {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    };

    const processCoordArray = (coords: number[][] | number[][][] | number[][][][]) => {
      for (const item of coords) {
        if (typeof item[0] === 'number') {
          processCoords(item as number[]);
        } else {
          processCoordArray(item as number[][] | number[][][]);
        }
      }
    };

    for (const feature of geojson.features) {
      if (!feature.geometry) continue;

      const geom = feature.geometry;
      if (geom.type === 'Point') {
        processCoords(geom.coordinates);
      } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
        processCoordArray(geom.coordinates);
      } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
        processCoordArray(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        processCoordArray(geom.coordinates);
      }
    }

    if (minLng !== Infinity) {
      this._map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: this._options.fitBoundsPadding }
      );
    }
  }

  /**
   * Removes all loaded datasets from the map.
   */
  private _removeAllDatasets(): void {
    for (const dataset of this._state.loadedDatasets) {
      if (this._map) {
        for (const layerId of dataset.layerIds) {
          if (this._map.getLayer(layerId)) {
            this._map.removeLayer(layerId);
          }
        }
        if (this._map.getSource(dataset.sourceId)) {
          this._map.removeSource(dataset.sourceId);
        }
      }
    }
    this._state.loadedDatasets = [];
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
   * Updates the button state to reflect loading status.
   */
  private _updateButtonState(): void {
    if (!this._button) return;

    if (this._state.isLoading) {
      this._button.classList.add('maplibre-gl-vector-dataset-button--loading');
      this._button.disabled = true;
    } else {
      this._button.classList.remove('maplibre-gl-vector-dataset-button--loading');
      this._button.disabled = false;
    }
  }
}
