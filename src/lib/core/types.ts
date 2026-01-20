import type { Map } from 'maplibre-gl';

/**
 * Position options for legend controls.
 */
export type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Orientation for colorbar display.
 */
export type ColorbarOrientation = 'horizontal' | 'vertical';

/**
 * Built-in colormap names (matplotlib-compatible).
 */
export type ColormapName =
  // Sequential
  | 'viridis'
  | 'plasma'
  | 'inferno'
  | 'magma'
  | 'cividis'
  // Diverging
  | 'coolwarm'
  | 'bwr'
  | 'seismic'
  | 'RdBu'
  | 'RdYlBu'
  | 'RdYlGn'
  | 'spectral'
  // Miscellaneous
  | 'jet'
  | 'rainbow'
  | 'turbo'
  | 'terrain'
  | 'ocean'
  | 'hot'
  | 'cool'
  | 'gray'
  | 'bone';

/**
 * Color stop definition for custom gradients.
 */
export interface ColorStop {
  /** Position from 0 to 1. */
  position: number;
  /** CSS color string (hex, rgb, rgba, hsl). */
  color: string;
}

/**
 * Tick mark configuration for colorbar.
 */
export interface TickConfig {
  /** Values at which to display ticks. */
  values?: number[];
  /** Number of auto-generated ticks (ignored if values provided). */
  count?: number;
  /** Format function for tick labels. */
  format?: (value: number) => string;
  /** Tick mark length in pixels. */
  length?: number;
}

/**
 * Options for configuring the Colorbar control.
 */
export interface ColorbarOptions {
  /** Colormap name or custom color array. */
  colormap?: ColormapName | string[];
  /** Custom color stops for fine-grained control. */
  colorStops?: ColorStop[];
  /** Minimum value for the colorbar. */
  vmin?: number;
  /** Maximum value for the colorbar. */
  vmax?: number;
  /** Title/label displayed above or beside the colorbar. */
  label?: string;
  /** Units to display after values. */
  units?: string;
  /** Orientation of the colorbar. */
  orientation?: ColorbarOrientation;
  /** Position on the map. */
  position?: ControlPosition;
  /** Width in pixels (for vertical) or height (for horizontal) of the gradient bar. */
  barThickness?: number;
  /** Length of the colorbar in pixels. */
  barLength?: number;
  /** Tick configuration. */
  ticks?: TickConfig;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the colorbar is initially visible. */
  visible?: boolean;
  /** Opacity of the colorbar container (0-1). */
  opacity?: number;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Font size for labels in pixels. */
  fontSize?: number;
  /** Font color for labels. */
  fontColor?: string;
  /** Border radius for container. */
  borderRadius?: number;
  /** Padding inside the container. */
  padding?: number;
  /** Minimum zoom level at which the colorbar is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the colorbar is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the Colorbar control.
 */
export interface ColorbarState {
  /** Whether the colorbar is visible. */
  visible: boolean;
  /** Current vmin value. */
  vmin: number;
  /** Current vmax value. */
  vmax: number;
  /** Current colormap. */
  colormap: ColormapName | string[];
}

/**
 * Props for the React Colorbar wrapper component.
 */
export interface ColorbarReactProps extends ColorbarOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when state changes. */
  onStateChange?: (state: ColorbarState) => void;
}

/**
 * Legend item definition.
 */
export interface LegendItem {
  /** Display label for the legend item. */
  label: string;
  /** Color for the swatch (CSS color string). */
  color: string;
  /** Optional outline/stroke color. */
  strokeColor?: string;
  /** Shape of the swatch. */
  shape?: 'square' | 'circle' | 'line';
  /** Optional icon URL to display instead of color swatch. */
  icon?: string;
}

/**
 * Options for configuring the Legend control.
 */
export interface LegendOptions {
  /** Legend title. */
  title?: string;
  /** Legend items to display. */
  items?: LegendItem[];
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the legend is initially visible. */
  visible?: boolean;
  /** Whether the legend is collapsible. */
  collapsible?: boolean;
  /** Whether the legend starts collapsed. */
  collapsed?: boolean;
  /** Width of the legend panel in pixels. */
  width?: number;
  /** Maximum height before scrolling. */
  maxHeight?: number;
  /** Opacity of the legend container (0-1). */
  opacity?: number;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Font size for labels in pixels. */
  fontSize?: number;
  /** Font color for labels. */
  fontColor?: string;
  /** Size of color swatches in pixels. */
  swatchSize?: number;
  /** Border radius for container. */
  borderRadius?: number;
  /** Padding inside the container. */
  padding?: number;
  /** Minimum zoom level at which the legend is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the legend is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the Legend control.
 */
export interface LegendState {
  /** Whether the legend is visible. */
  visible: boolean;
  /** Whether the legend is collapsed. */
  collapsed: boolean;
  /** Current legend items. */
  items: LegendItem[];
}

/**
 * Props for the React Legend wrapper component.
 */
export interface LegendReactProps extends LegendOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when state changes. */
  onStateChange?: (state: LegendState) => void;
}

/**
 * Options for configuring the HtmlControl.
 */
export interface HtmlControlOptions {
  /** HTML content string. */
  html?: string;
  /** Or provide an element directly. */
  element?: HTMLElement;
  /** Title for the control header (shown when collapsible). */
  title?: string;
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. */
  visible?: boolean;
  /** Whether the control is collapsible. */
  collapsible?: boolean;
  /** Whether the control starts collapsed. */
  collapsed?: boolean;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Padding inside the container in pixels. */
  padding?: number;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Maximum width of the container. */
  maxWidth?: number;
  /** Maximum height of the container. */
  maxHeight?: number;
  /** Font size for labels in pixels. */
  fontSize?: number;
  /** Font color for labels. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the HtmlControl.
 */
export interface HtmlControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the control is collapsed. */
  collapsed: boolean;
  /** Current HTML content. */
  html: string;
}

/**
 * Props for the React HtmlControl wrapper component.
 */
export interface HtmlControlReactProps extends HtmlControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when state changes. */
  onStateChange?: (state: HtmlControlState) => void;
}

/**
 * Event types emitted by legend/colorbar controls.
 */
export type ComponentEvent = 'show' | 'hide' | 'update' | 'collapse' | 'expand';

/**
 * Event handler function type.
 */
export type ComponentEventHandler<T> = (event: { type: ComponentEvent; state: T }) => void;

/**
 * Colormap definition with color stops.
 */
export interface ColormapDefinition {
  /** Name of the colormap. */
  name: string;
  /** Array of color stops from 0 to 1. */
  colors: ColorStop[];
}

/**
 * Display mode for the basemap control.
 */
export type BasemapDisplayMode = 'dropdown' | 'gallery' | 'list';

/**
 * Basemap item definition.
 */
export interface BasemapItem {
  /** Unique identifier for the basemap. */
  id: string;
  /** Display name. */
  name: string;
  /** Optional group/category for organization. */
  group?: string;
  /** Tile URL template for XYZ sources (with {z}, {x}, {y} placeholders). */
  url?: string;
  /** MapLibre style URL for vector styles. */
  style?: string;
  /** Attribution text. */
  attribution?: string;
  /** Optional thumbnail URL for preview. */
  thumbnail?: string;
  /** Maximum zoom level. */
  maxZoom?: number;
  /** Minimum zoom level. */
  minZoom?: number;
  /** Whether this basemap requires an API key. */
  requiresApiKey?: boolean;
  /** API key if required. */
  apiKey?: string;
  /** Variant name for URL template (e.g., 'light_all' for CartoDB). */
  variant?: string;
  /** File extension for URL template (e.g., 'png', 'jpg'). */
  ext?: string;
}

/**
 * Options for configuring the BasemapControl.
 */
export interface BasemapControlOptions {
  /** Array of basemap items to display. */
  basemaps?: BasemapItem[];
  /** URL to fetch providers.json from xyzservices. Defaults to xyzservices URL. */
  providersUrl?: string;
  /** Initial/default basemap ID. */
  defaultBasemap?: string;
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. */
  visible?: boolean;
  /** Whether the control is collapsible. */
  collapsible?: boolean;
  /** Whether the control starts collapsed. */
  collapsed?: boolean;
  /** UI display mode: 'dropdown', 'gallery', or 'list'. */
  displayMode?: BasemapDisplayMode;
  /** Whether to show search/filter input. */
  showSearch?: boolean;
  /** Filter providers by group names (only include these groups). */
  filterGroups?: string[];
  /** Exclude specific provider groups. */
  excludeGroups?: string[];
  /** Exclude broken providers (status: "broken"). Default: true. */
  excludeBroken?: boolean;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Padding inside the container in pixels. */
  padding?: number;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Maximum width of the container. */
  maxWidth?: number;
  /** Maximum height of the container. */
  maxHeight?: number;
  /** Font size for labels in pixels. */
  fontSize?: number;
  /** Font color for labels. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
  /** Layer ID to insert the basemap layer before (for layer ordering). */
  beforeId?: string;
  /** Whether to place basemap below labels (before first symbol layer). Default: false. */
  belowLabels?: boolean;
}

/**
 * Internal state of the BasemapControl.
 */
export interface BasemapControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the control is collapsed. */
  collapsed: boolean;
  /** Currently selected basemap ID. */
  selectedBasemap: string | null;
  /** Search/filter text. */
  searchText: string;
  /** Loading state for async operations. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Whether basemap is placed below labels. */
  belowLabels: boolean;
}

/**
 * Props for the React BasemapControl wrapper component.
 */
export interface BasemapControlReactProps extends BasemapControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when basemap changes. */
  onBasemapChange?: (basemap: BasemapItem) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: BasemapControlState) => void;
}

/**
 * Basemap-specific event types.
 */
export type BasemapEvent = ComponentEvent | 'basemapchange';

/**
 * Terrain encoding format.
 */
export type TerrainEncoding = 'terrarium' | 'mapbox';

/**
 * Options for configuring the TerrainControl.
 */
export interface TerrainControlOptions {
  /** Terrain tile source URL template. Defaults to AWS Terrarium tiles. */
  sourceUrl?: string;
  /** Terrain encoding format. Default: 'terrarium'. */
  encoding?: TerrainEncoding;
  /** Vertical exaggeration factor for terrain. Default: 1.0. */
  exaggeration?: number;
  /** Whether terrain is enabled by default. Default: false. */
  enabled?: boolean;
  /** Whether to add hillshade layer for better visualization. Default: true. */
  hillshade?: boolean;
  /** Hillshade exaggeration factor (0-1). Default: 0.5. */
  hillshadeExaggeration?: number;
  /** Minimum source zoom level for terrain tiles. Default: 0. */
  sourceMinzoom?: number;
  /** Maximum source zoom level for terrain tiles. Default: 15. */
  sourceMaxzoom?: number;
  /** Tile size for raster-dem source. Default: 256. */
  tileSize?: number;
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Background color of the control button. */
  backgroundColor?: string;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the TerrainControl.
 */
export interface TerrainControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether terrain is currently enabled. */
  enabled: boolean;
  /** Current exaggeration value. */
  exaggeration: number;
  /** Whether hillshade is enabled. */
  hillshade: boolean;
}

/**
 * Props for the React TerrainControl wrapper component.
 */
export interface TerrainControlReactProps extends TerrainControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when terrain is toggled. */
  onTerrainChange?: (enabled: boolean) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: TerrainControlState) => void;
}

/**
 * Terrain-specific event types.
 */
export type TerrainEvent = ComponentEvent | 'terrainchange';

/**
 * Terrain event handler function type.
 */
export type TerrainEventHandler = (event: { type: TerrainEvent; state: TerrainControlState }) => void;

/**
 * Search result item from geocoding service.
 */
export interface SearchResult {
  /** Unique identifier for the result. */
  id: string;
  /** Display name of the place. */
  name: string;
  /** Full display name with address details. */
  displayName: string;
  /** Longitude coordinate. */
  lng: number;
  /** Latitude coordinate. */
  lat: number;
  /** Bounding box [west, south, east, north]. */
  bbox?: [number, number, number, number];
  /** Type of place (city, street, etc.). */
  type?: string;
  /** Importance/relevance score. */
  importance?: number;
}

/**
 * Options for configuring the SearchControl.
 */
export interface SearchControlOptions {
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the control starts collapsed (icon only). Default: true. */
  collapsed?: boolean;
  /** Placeholder text for the search input. Default: 'Search places...'. */
  placeholder?: string;
  /** Geocoding service URL. Defaults to Nominatim. */
  geocoderUrl?: string;
  /** Maximum number of results to display. Default: 5. */
  maxResults?: number;
  /** Debounce delay in ms for search requests. Default: 300. */
  debounceMs?: number;
  /** Zoom level to fly to when selecting a result. Default: 14. */
  flyToZoom?: number;
  /** Whether to add a marker at the selected location. Default: true. */
  showMarker?: boolean;
  /** Color for the result marker. Default: '#4264fb'. */
  markerColor?: string;
  /** Whether to collapse after selecting a result. Default: true. */
  collapseOnSelect?: boolean;
  /** Whether to clear results after selecting. Default: true. */
  clearOnSelect?: boolean;
  /** Custom geocoder function (overrides geocoderUrl). */
  geocoder?: (query: string) => Promise<SearchResult[]>;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Width of the expanded search panel. Default: 280. */
  width?: number;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font color. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the SearchControl.
 */
export interface SearchControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the control is collapsed. */
  collapsed: boolean;
  /** Current search query. */
  query: string;
  /** Current search results. */
  results: SearchResult[];
  /** Whether a search is in progress. */
  loading: boolean;
  /** Selected result. */
  selectedResult: SearchResult | null;
  /** Error message if any. */
  error: string | null;
}

/**
 * Props for the React SearchControl wrapper component.
 */
export interface SearchControlReactProps extends SearchControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a search result is selected. */
  onResultSelect?: (result: SearchResult) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: SearchControlState) => void;
}

/**
 * Search-specific event types.
 */
export type SearchEvent = ComponentEvent | 'resultselect' | 'search' | 'clear';

/**
 * Search event handler function type.
 */
export type SearchEventHandler = (event: { type: SearchEvent; state: SearchControlState; result?: SearchResult }) => void;

/**
 * Supported vector file formats.
 *
 * DuckDB's spatial extension uses GDAL under the hood, enabling support
 * for many common geospatial formats via ST_Read().
 */
export type VectorFormat =
  | 'geojson'
  | 'shapefile'
  | 'geopackage'
  | 'geoparquet'
  | 'kml'
  | 'kmz'
  | 'gpx'
  | 'flatgeobuf'
  | 'gml'
  | 'topojson'
  | 'csv'
  | 'xlsx'
  | 'dxf'
  | 'unknown';

/**
 * Progress information for file conversion operations.
 */
export interface ConversionProgress {
  /** Current stage of the conversion. */
  stage: 'loading' | 'initializing' | 'converting' | 'complete' | 'error';
  /** Progress percentage (0-100). */
  percent?: number;
  /** Human-readable progress message. */
  message?: string;
}

/**
 * Callback type for conversion progress updates.
 */
export type ConversionProgressCallback = (progress: ConversionProgress) => void;

/**
 * Loaded vector dataset information.
 */
export interface LoadedDataset {
  /** Unique identifier for the dataset. */
  id: string;
  /** Original filename. */
  filename: string;
  /** Source ID in MapLibre. */
  sourceId: string;
  /** Array of layer IDs created for this dataset. */
  layerIds: string[];
  /** GeoJSON feature count. */
  featureCount: number;
  /** Geometry types present in the dataset. */
  geometryTypes: ('Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon')[];
  /** Timestamp when loaded. */
  loadedAt: Date;
  /** Original file format (geojson, shapefile, geopackage). */
  originalFormat?: VectorFormat;
}

/**
 * Default styling options for vector layers.
 */
export interface VectorLayerStyle {
  /** Fill color for polygons. */
  fillColor?: string;
  /** Fill opacity for polygons (0-1). */
  fillOpacity?: number;
  /** Stroke/line color. */
  strokeColor?: string;
  /** Stroke/line width in pixels. */
  strokeWidth?: number;
  /** Stroke opacity (0-1). */
  strokeOpacity?: number;
  /** Circle radius for points in pixels. */
  circleRadius?: number;
  /** Circle color for points. */
  circleColor?: string;
  /** Circle stroke color for points. */
  circleStrokeColor?: string;
  /** Circle stroke width for points. */
  circleStrokeWidth?: number;
}

/**
 * Options for configuring the VectorDatasetControl.
 */
export interface VectorDatasetControlOptions {
  /** Position on the map. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether to show a drop zone overlay when dragging files. Default: true. */
  showDropZone?: boolean;
  /** Accepted file extensions. Default: ['.geojson', '.json']. */
  acceptedExtensions?: string[];
  /** Whether to allow multiple file uploads. Default: true. */
  multiple?: boolean;
  /** Default styling for loaded layers. */
  defaultStyle?: VectorLayerStyle;
  /** Whether to fit map bounds to loaded data. Default: true. */
  fitBounds?: boolean;
  /** Padding for fitBounds in pixels. Default: 50. */
  fitBoundsPadding?: number;
  /** Maximum file size in bytes. Default: 50MB (52428800). */
  maxFileSize?: number;
  /** Background color of the control button. */
  backgroundColor?: string;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
  /**
   * Enable support for advanced formats (Shapefile, GeoPackage).
   * When enabled, DuckDB WASM will be lazy-loaded when processing these formats.
   * Default: false.
   */
  enableAdvancedFormats?: boolean;
  /**
   * Custom URL for DuckDB WASM bundles.
   * Useful for self-hosting the WASM files or using a different CDN.
   */
  duckdbBundleUrl?: string;
  /**
   * Callback for conversion progress updates.
   * Called during file conversion with progress information.
   */
  onConversionProgress?: ConversionProgressCallback;
}

/**
 * Internal state of the VectorDatasetControl.
 */
export interface VectorDatasetControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether a file is being dragged over the map. */
  isDragging: boolean;
  /** Whether files are currently being loaded. */
  isLoading: boolean;
  /** Array of loaded datasets. */
  loadedDatasets: LoadedDataset[];
  /** Error message if any. */
  error: string | null;
}

/**
 * Props for the React VectorDatasetControl wrapper component.
 */
export interface VectorDatasetControlReactProps extends VectorDatasetControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a dataset is loaded. */
  onDatasetLoad?: (dataset: LoadedDataset) => void;
  /** Callback fired when an error occurs. */
  onError?: (error: string, filename?: string) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: VectorDatasetControlState) => void;
}

/**
 * VectorDataset-specific event types.
 */
export type VectorDatasetEvent = ComponentEvent | 'load' | 'error' | 'dragenter' | 'dragleave';

/**
 * VectorDataset event handler function type.
 */
export type VectorDatasetEventHandler = (event: {
  type: VectorDatasetEvent;
  state: VectorDatasetControlState;
  dataset?: LoadedDataset;
  error?: string;
  filename?: string;
}) => void;

/**
 * Highlight style configuration for inspected features.
 */
export interface InspectHighlightStyle {
  /** Fill color for polygons (CSS color string). Default: '#ffff00'. */
  fillColor?: string;
  /** Fill opacity for polygons (0-1). Default: 0.3. */
  fillOpacity?: number;
  /** Stroke/line color for all geometry types. Default: '#ffff00'. */
  strokeColor?: string;
  /** Stroke/line width in pixels. Default: 3. */
  strokeWidth?: number;
  /** Circle radius for points in pixels. Default: 10. */
  circleRadius?: number;
  /** Circle stroke width for points in pixels. Default: 3. */
  circleStrokeWidth?: number;
}

/**
 * Inspected feature information.
 */
export interface InspectedFeature {
  /** Unique identifier for this inspection instance. */
  id: string;
  /** The GeoJSON feature object with geometry and properties. */
  feature: GeoJSON.Feature;
  /** Layer ID the feature belongs to. */
  layerId: string;
  /** Source ID the feature belongs to. */
  sourceId: string;
  /** Source layer (for vector tile sources). */
  sourceLayer?: string;
  /** Feature ID from the source, if available. */
  featureId?: string | number;
  /** Click coordinates [lng, lat]. */
  lngLat: [number, number];
}

/**
 * Options for configuring the InspectControl.
 */
export interface InspectControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether inspect mode is enabled by default. Default: false. */
  enabled?: boolean;
  /** Maximum number of features to show when multiple at same point. Default: 10. */
  maxFeatures?: number;
  /** Only inspect features from these layers. If empty, inspect all. */
  includeLayers?: string[];
  /** Skip features from these layers. */
  excludeLayers?: string[];
  /** Highlight style for selected features. */
  highlightStyle?: InspectHighlightStyle;
  /** Properties to always exclude from display (e.g., internal IDs). */
  excludeProperties?: string[];
  /** Whether to show geometry type in the popup. Default: true. */
  showGeometryType?: boolean;
  /** Whether to show layer name in the popup. Default: true. */
  showLayerName?: boolean;
  /** Maximum width of popup in pixels. Default: 320. */
  maxWidth?: number;
  /** Maximum height of popup content in pixels. Default: 300. */
  maxHeight?: number;
  /** Background color of the container. */
  backgroundColor?: string;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font color. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the InspectControl.
 */
export interface InspectControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether inspect mode is enabled. */
  enabled: boolean;
  /** Currently inspected features. */
  inspectedFeatures: InspectedFeature[];
  /** Index of currently selected feature (when multiple). */
  selectedIndex: number;
  /** Error message if any. */
  error: string | null;
}

/**
 * Props for the React InspectControl wrapper component.
 */
export interface InspectControlReactProps extends InspectControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a feature is selected/clicked. */
  onFeatureSelect?: (feature: InspectedFeature | null) => void;
  /** Callback fired when features are inspected (may be multiple). */
  onInspect?: (features: InspectedFeature[]) => void;
  /** Callback fired when inspect mode is toggled. */
  onToggle?: (enabled: boolean) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: InspectControlState) => void;
}

/**
 * Inspect-specific event types.
 */
export type InspectEvent = ComponentEvent | 'enable' | 'disable' | 'featureselect' | 'clear';

/**
 * Inspect event handler function type.
 */
export type InspectEventHandler = (event: {
  type: InspectEvent;
  state: InspectControlState;
  feature?: InspectedFeature;
  features?: InspectedFeature[];
}) => void;
