import type { IControl, Map } from "maplibre-gl";

/**
 * Position options for legend controls.
 */
export type ControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * Orientation for colorbar display.
 */
export type ColorbarOrientation = "horizontal" | "vertical";

/**
 * Built-in colormap names (matplotlib-compatible).
 */
export type ColormapName =
  // Sequential
  | "viridis"
  | "plasma"
  | "inferno"
  | "magma"
  | "cividis"
  // Diverging
  | "coolwarm"
  | "bwr"
  | "seismic"
  | "RdBu"
  | "RdYlBu"
  | "RdYlGn"
  | "spectral"
  // Miscellaneous
  | "jet"
  | "rainbow"
  | "turbo"
  | "terrain"
  | "ocean"
  | "hot"
  | "cool"
  | "gray"
  | "bone";

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
  shape?: "square" | "circle" | "line";
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
export type ComponentEvent = "show" | "hide" | "update" | "collapse" | "expand";

/**
 * Event handler function type.
 */
export type ComponentEventHandler<T> = (event: {
  type: ComponentEvent;
  state: T;
}) => void;

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
export type BasemapDisplayMode = "dropdown" | "gallery" | "list";

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
export type BasemapEvent = ComponentEvent | "basemapchange";

/**
 * Terrain encoding format.
 */
export type TerrainEncoding = "terrarium" | "mapbox";

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
export type TerrainEvent = ComponentEvent | "terrainchange";

/**
 * Terrain event handler function type.
 */
export type TerrainEventHandler = (event: {
  type: TerrainEvent;
  state: TerrainControlState;
}) => void;

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
export type SearchEvent = ComponentEvent | "resultselect" | "search" | "clear";

/**
 * Search event handler function type.
 */
export type SearchEventHandler = (event: {
  type: SearchEvent;
  state: SearchControlState;
  result?: SearchResult;
}) => void;

/**
 * Supported vector file formats.
 *
 * DuckDB's spatial extension uses GDAL under the hood, enabling support
 * for many common geospatial formats via ST_Read().
 */
export type VectorFormat =
  | "geojson"
  | "shapefile"
  | "geopackage"
  | "geoparquet"
  | "kml"
  | "kmz"
  | "gpx"
  | "flatgeobuf"
  | "gml"
  | "topojson"
  | "csv"
  | "xlsx"
  | "dxf"
  | "unknown";

/**
 * Progress information for file conversion operations.
 */
export interface ConversionProgress {
  /** Current stage of the conversion. */
  stage: "loading" | "initializing" | "converting" | "complete" | "error";
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
  geometryTypes: (
    | "Point"
    | "LineString"
    | "Polygon"
    | "MultiPoint"
    | "MultiLineString"
    | "MultiPolygon"
  )[];
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
export type VectorDatasetEvent =
  | ComponentEvent
  | "load"
  | "error"
  | "dragenter"
  | "dragleave";

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
export type InspectEvent =
  | ComponentEvent
  | "enable"
  | "disable"
  | "featureselect"
  | "clear";

/**
 * Inspect event handler function type.
 */
export type InspectEventHandler = (event: {
  type: InspectEvent;
  state: InspectControlState;
  feature?: InspectedFeature;
  features?: InspectedFeature[];
}) => void;

/**
 * Options for configuring the ViewStateControl.
 */
export interface ViewStateControlOptions {
  /** Position on the map. Default: 'bottom-left'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Decimal precision for coordinate values. Default: 4. */
  precision?: number;
  /** Whether to show center coordinates. Default: true. */
  showCenter?: boolean;
  /** Whether to show map bounds. Default: true. */
  showBounds?: boolean;
  /** Whether to show zoom level. Default: true. */
  showZoom?: boolean;
  /** Whether to show pitch value. Default: true. */
  showPitch?: boolean;
  /** Whether to show bearing value. Default: true. */
  showBearing?: boolean;
  /** Whether to enable bounding box drawing. Default: false. */
  enableBBox?: boolean;
  /** Fill color for drawn bounding box. Default: 'rgba(0, 120, 215, 0.1)'. */
  bboxFillColor?: string;
  /** Stroke color for drawn bounding box. Default: '#0078d7'. */
  bboxStrokeColor?: string;
  /** Stroke width for drawn bounding box. Default: 2. */
  bboxStrokeWidth?: number;
  /** Width of the info panel in pixels. Default: 280. */
  panelWidth?: number;
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
 * Internal state of the ViewStateControl.
 */
export interface ViewStateControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current map center [lng, lat]. */
  center: [number, number];
  /** Current map bounds [west, south, east, north]. */
  bounds: [number, number, number, number];
  /** Current zoom level. */
  zoom: number;
  /** Current pitch in degrees. */
  pitch: number;
  /** Current bearing in degrees. */
  bearing: number;
  /** Whether bbox drawing mode is active. */
  drawingBBox: boolean;
  /** Drawn bounding box [west, south, east, north], or null if none. */
  drawnBBox: [number, number, number, number] | null;
}

/**
 * Props for the React ViewStateControl wrapper component.
 */
export interface ViewStateControlReactProps extends ViewStateControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a bounding box is drawn. */
  onBBoxDraw?: (bbox: [number, number, number, number]) => void;
  /** Callback fired when bbox drawing mode is toggled. */
  onDrawingToggle?: (drawing: boolean) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: ViewStateControlState) => void;
}

/**
 * ViewState-specific event types.
 */
export type ViewStateEvent =
  | ComponentEvent
  | "viewchange"
  | "bboxdraw"
  | "bboxclear"
  | "drawstart"
  | "drawend";

/**
 * ViewState event handler function type.
 */
export type ViewStateEventHandler = (event: {
  type: ViewStateEvent;
  state: ViewStateControlState;
  bbox?: [number, number, number, number];
}) => void;

/**
 * Names of built-in controls that can be added to a ControlGrid via `defaultControls`.
 */
export type DefaultControlName =
  | "fullscreen"
  | "globe"
  | "north"
  | "terrain"
  | "search"
  | "viewState"
  | "inspect"
  | "vectorDataset"
  | "basemap"
  | "cogLayer"
  | "minimap"
  | "measure"
  | "bookmark"
  | "print"
  | "zarrLayer"
  | "pmtilesLayer"
  | "stacLayer"
  | "stacSearch";

/**
 * Options for configuring the ControlGrid.
 */
export interface ControlGridOptions {
  /** Title for the control header. */
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
  /** Number of rows in the grid. */
  rows?: number;
  /** Number of columns in the grid. */
  columns?: number;
  /** Show row/column number inputs in the UI. */
  showRowColumnControls?: boolean;
  /** Initial controls to display in the grid (IControl instances). */
  controls?: IControl[];
  /** Built-in controls to create and add automatically (e.g. ['globe', 'terrain', 'search']). */
  defaultControls?: DefaultControlName[];
  /** Background color of the container. */
  backgroundColor?: string;
  /** Padding inside the container in pixels. */
  padding?: number;
  /** Border radius for container. */
  borderRadius?: number;
  /** Opacity of the container (0-1). */
  opacity?: number;
  /** Gap between grid cells in pixels. */
  gap?: number;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the ControlGrid.
 */
export interface ControlGridState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the control is collapsed. */
  collapsed: boolean;
  /** Current number of rows. */
  rows: number;
  /** Current number of columns. */
  columns: number;
}

/**
 * Props for the React ControlGrid wrapper component.
 */
export interface ControlGridReactProps extends ControlGridOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when state changes. */
  onStateChange?: (state: ControlGridState) => void;
}

/**
 * ControlGrid-specific event types.
 */
export type ControlGridEvent = ComponentEvent | "controladd" | "controlremove";

/**
 * ControlGrid event handler function type.
 */
export type ControlGridEventHandler = (event: {
  type: ControlGridEvent;
  state: ControlGridState;
  control?: IControl;
}) => void;

/**
 * Information about a single added COG layer.
 */
export interface CogLayerInfo {
  /** Unique layer identifier. */
  id: string;
  /** COG URL. */
  url: string;
  /** Bands string. */
  bands: string;
  /** Colormap name. */
  colormap: ColormapName | "none";
  /** Rescale minimum. */
  rescaleMin: number;
  /** Rescale maximum. */
  rescaleMax: number;
  /** Nodata value. */
  nodata: number | undefined;
  /** Layer opacity. */
  opacity: number;
}

/**
 * Options for configuring the CogLayerControl.
 */
export interface CogLayerControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Layer ID to insert COG layers before. If not specified, layers are added on top. */
  beforeId?: string;
  /** Default COG URL to pre-fill. */
  defaultUrl?: string;
  /** Whether to automatically load the defaultUrl when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default bands (comma-separated, e.g. '1' or '1,2,3'). Default: '1'. */
  defaultBands?: string;
  /** Default colormap name. Default: 'viridis'. */
  defaultColormap?: ColormapName | "none";
  /** Default rescale minimum. Default: 0. */
  defaultRescaleMin?: number;
  /** Default rescale maximum. Default: 255. */
  defaultRescaleMax?: number;
  /** Default nodata value. */
  defaultNodata?: number;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Whether COG layers are pickable (clickable to show pixel values). Default: true. */
  defaultPickable?: boolean;
  /** Width of the panel in pixels. Default: 300. */
  panelWidth?: number;
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
 * Internal state of the CogLayerControl.
 */
export interface CogLayerControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current COG URL. */
  url: string;
  /** Current bands. */
  bands: string;
  /** Current colormap. */
  colormap: ColormapName | "none";
  /** Current rescale min. */
  rescaleMin: number;
  /** Current rescale max. */
  rescaleMax: number;
  /** Current nodata value. */
  nodata: number | undefined;
  /** Current opacity (0-1). */
  layerOpacity: number;
  /** Whether layers are pickable (clickable). */
  pickable: boolean;
  /** Whether any COG layer is currently active. */
  hasLayer: boolean;
  /** Number of active COG layers. */
  layerCount: number;
  /** Information about all active COG layers. */
  layers: CogLayerInfo[];
  /** Whether the layer is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * Props for the React CogLayerControl wrapper component.
 */
export interface CogLayerControlReactProps extends CogLayerControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a layer is added. */
  onLayerAdd?: (url: string) => void;
  /** Callback fired when a layer is removed. */
  onLayerRemove?: () => void;
  /** Callback fired when a layer is updated. */
  onLayerUpdate?: (url: string) => void;
  /** Callback fired when an error occurs. */
  onError?: (error: string) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: CogLayerControlState) => void;
}

/**
 * CogLayer-specific event types.
 */
export type CogLayerEvent =
  | ComponentEvent
  | "layeradd"
  | "layerremove"
  | "layerupdate"
  | "error";

/**
 * CogLayer event handler function type.
 */
export type CogLayerEventHandler = (event: {
  type: CogLayerEvent;
  state: CogLayerControlState;
  url?: string;
  error?: string;
  layerId?: string;
}) => void;

// =============================================================================
// ZarrLayerControl Types
// =============================================================================

/**
 * Information about a single added Zarr layer.
 */
export interface ZarrLayerInfo {
  /** Unique layer identifier. */
  id: string;
  /** Zarr URL. */
  url: string;
  /** Variable name. */
  variable: string;
  /** Colormap (array of hex colors). */
  colormap: string[];
  /** Color limits [min, max]. */
  clim: [number, number];
  /** Selector for dimensions (e.g., { time: 0, band: 'prec' }). */
  selector?: Record<string, number | string>;
  /** Layer opacity. */
  opacity: number;
}

/**
 * Options for configuring the ZarrLayerControl.
 */
export interface ZarrLayerControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Layer ID to insert Zarr layers before. If not specified, layers are added on top. */
  beforeId?: string;
  /** Default Zarr URL to pre-fill. */
  defaultUrl?: string;
  /** Whether to automatically load the defaultUrl when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default variable name. Default: ''. */
  defaultVariable?: string;
  /** Default colormap (array of hex colors). */
  defaultColormap?: string[];
  /** Default color limits. Default: [0, 1]. */
  defaultClim?: [number, number];
  /** Default selector for dimensions. */
  defaultSelector?: Record<string, number | string>;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Whether Zarr layers are pickable (clickable to show info). Default: true. */
  defaultPickable?: boolean;
  /** Width of the panel in pixels. Default: 300. */
  panelWidth?: number;
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
 * Internal state of the ZarrLayerControl.
 */
export interface ZarrLayerControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current Zarr URL. */
  url: string;
  /** Current variable name. */
  variable: string;
  /** Current colormap. */
  colormap: string[];
  /** Current color limits. */
  clim: [number, number];
  /** Current selector. */
  selector?: Record<string, number | string>;
  /** Current opacity (0-1). */
  layerOpacity: number;
  /** Whether layers are pickable (clickable). */
  pickable: boolean;
  /** Whether any Zarr layer is currently active. */
  hasLayer: boolean;
  /** Number of active Zarr layers. */
  layerCount: number;
  /** Information about all active Zarr layers. */
  layers: ZarrLayerInfo[];
  /** Whether the layer is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * Props for the React ZarrLayerControl wrapper component.
 */
export interface ZarrLayerControlReactProps extends ZarrLayerControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a layer is added. */
  onLayerAdd?: (url: string) => void;
  /** Callback fired when a layer is removed. */
  onLayerRemove?: () => void;
  /** Callback fired when a layer is updated. */
  onLayerUpdate?: (url: string) => void;
  /** Callback fired when an error occurs. */
  onError?: (error: string) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: ZarrLayerControlState) => void;
}

/**
 * ZarrLayer-specific event types.
 */
export type ZarrLayerEvent =
  | ComponentEvent
  | "layeradd"
  | "layerremove"
  | "layerupdate"
  | "error";

/**
 * ZarrLayer event handler function type.
 */
export type ZarrLayerEventHandler = (event: {
  type: ZarrLayerEvent;
  state: ZarrLayerControlState;
  url?: string;
  error?: string;
  layerId?: string;
}) => void;

// =============================================================================
// PMTilesLayerControl Types
// =============================================================================

/**
 * PMTiles tile type.
 */
export type PMTilesTileType = "vector" | "raster" | "unknown";

/**
 * Information about a single added PMTiles layer.
 */
export interface PMTilesLayerInfo {
  /** Unique layer identifier. */
  id: string;
  /** PMTiles URL. */
  url: string;
  /** Tile type (vector or raster). */
  tileType: PMTilesTileType;
  /** Source layers available (for vector tiles). */
  sourceLayers: string[];
  /** MapLibre layer IDs created for this source. */
  layerIds: string[];
  /** Layer opacity. */
  opacity: number;
  /** Whether features are pickable (clickable). */
  pickable: boolean;
}

/**
 * Options for configuring the PMTilesLayerControl.
 */
export interface PMTilesLayerControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Layer ID to insert PMTiles layers before. If not specified, layers are added on top. */
  beforeId?: string;
  /** Default PMTiles URL to pre-fill. */
  defaultUrl?: string;
  /** Whether to automatically load the defaultUrl when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Default fill color for vector polygons. Default: 'steelblue'. */
  defaultFillColor?: string;
  /** Default line color for vector lines. Default: '#333'. */
  defaultLineColor?: string;
  /** Default circle color for vector points. Default: 'steelblue'. */
  defaultCircleColor?: string;
  /** Whether features are pickable (clickable) by default. Default: true. */
  defaultPickable?: boolean;
  /** Width of the panel in pixels. Default: 300. */
  panelWidth?: number;
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
 * Internal state of the PMTilesLayerControl.
 */
export interface PMTilesLayerControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current PMTiles URL. */
  url: string;
  /** Current opacity (0-1). */
  layerOpacity: number;
  /** Available source layers (fetched from metadata). */
  availableSourceLayers: string[];
  /** Selected source layers to render. */
  selectedSourceLayers: string[];
  /** Whether features are pickable (clickable). */
  pickable: boolean;
  /** Whether any PMTiles layer is currently active. */
  hasLayer: boolean;
  /** Number of active PMTiles layers. */
  layerCount: number;
  /** Information about all active PMTiles layers. */
  layers: PMTilesLayerInfo[];
  /** Whether the layer is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * Props for the React PMTilesLayerControl wrapper component.
 */
export interface PMTilesLayerControlReactProps extends PMTilesLayerControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a layer is added. */
  onLayerAdd?: (url: string) => void;
  /** Callback fired when a layer is removed. */
  onLayerRemove?: () => void;
  /** Callback fired when an error occurs. */
  onError?: (error: string) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: PMTilesLayerControlState) => void;
}

/**
 * PMTilesLayer-specific event types.
 */
export type PMTilesLayerEvent =
  | ComponentEvent
  | "layeradd"
  | "layerremove"
  | "error";

/**
 * PMTilesLayer event handler function type.
 */
export type PMTilesLayerEventHandler = (event: {
  type: PMTilesLayerEvent;
  state: PMTilesLayerControlState;
  url?: string;
  error?: string;
  layerId?: string;
}) => void;

// =============================================================================
// AddVectorControl Types
// =============================================================================

/**
 * Supported remote vector format types for AddVectorControl.
 */
export type RemoteVectorFormat =
  | "geojson"
  | "geoparquet"
  | "flatgeobuf"
  | "auto";

/**
 * Information about a single added vector layer from URL.
 */
export interface AddVectorLayerInfo {
  /** Unique layer identifier. */
  id: string;
  /** Vector data URL. */
  url: string;
  /** Detected or specified format. */
  format: RemoteVectorFormat;
  /** Source ID in MapLibre. */
  sourceId: string;
  /** Array of layer IDs created for this dataset. */
  layerIds: string[];
  /** GeoJSON feature count. */
  featureCount: number;
  /** Geometry types present in the dataset. */
  geometryTypes: string[];
  /** Layer opacity. */
  opacity: number;
  /** Fill color. */
  fillColor: string;
  /** Stroke color. */
  strokeColor: string;
  /** Whether the layer is pickable (clickable). */
  pickable?: boolean;
}

/**
 * Options for configuring the AddVectorControl.
 */
export interface AddVectorControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Layer ID to insert vector layers before. If not specified, layers are added on top. */
  beforeId?: string;
  /** Default URL to pre-fill. */
  defaultUrl?: string;
  /** Default layer name to pre-fill. If not specified, a unique ID is generated. */
  defaultLayerName?: string;
  /** Whether to automatically load the defaultUrl when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default format. Default: 'auto'. */
  defaultFormat?: RemoteVectorFormat;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Default fill color for polygons. Default: '#3388ff'. */
  defaultFillColor?: string;
  /** Default stroke color for lines and polygon outlines. Default: '#3388ff'. */
  defaultStrokeColor?: string;
  /** Default circle color for points. Default: '#3388ff'. */
  defaultCircleColor?: string;
  /** Whether layers are pickable (clickable to show feature info). Default: true. */
  defaultPickable?: boolean;
  /** CORS proxy URL prefix for fetching files from servers without CORS. The URL will be appended. */
  corsProxy?: string;
  /** Whether to fit map bounds to loaded data. Default: true. */
  fitBounds?: boolean;
  /** Padding for fitBounds in pixels. Default: 50. */
  fitBoundsPadding?: number;
  /** Width of the panel in pixels. Default: 300. */
  panelWidth?: number;
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
 * Internal state of the AddVectorControl.
 */
export interface AddVectorControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current vector URL. */
  url: string;
  /** Current layer name (optional, auto-generated if empty). */
  layerName: string;
  /** Current beforeId for layer ordering. */
  beforeId: string;
  /** Current format. */
  format: RemoteVectorFormat;
  /** Current opacity (0-1). */
  layerOpacity: number;
  /** Current fill color. */
  fillColor: string;
  /** Current stroke color. */
  strokeColor: string;
  /** Current circle/point color. */
  circleColor: string;
  /** Whether layers are pickable (clickable). */
  pickable: boolean;
  /** Whether any vector layer is currently active. */
  hasLayer: boolean;
  /** Number of active vector layers. */
  layerCount: number;
  /** Information about all active vector layers. */
  layers: AddVectorLayerInfo[];
  /** Whether the layer is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * Props for a potential React AddVectorControl wrapper component.
 * Note: No React wrapper is currently implemented. This interface is provided
 * for type consistency with other controls and future implementation.
 */
export interface AddVectorControlReactProps extends AddVectorControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when a layer is added. */
  onLayerAdd?: (url: string) => void;
  /** Callback fired when a layer is removed. */
  onLayerRemove?: () => void;
  /** Callback fired when an error occurs. */
  onError?: (error: string) => void;
  /** Callback fired when state changes. */
  onStateChange?: (state: AddVectorControlState) => void;
}

/**
 * AddVector-specific event types.
 */
export type AddVectorEvent =
  | ComponentEvent
  | "layeradd"
  | "layerremove"
  | "error";

/**
 * AddVector event handler function type.
 */
export type AddVectorEventHandler = (event: {
  type: AddVectorEvent;
  state: AddVectorControlState;
  url?: string;
  error?: string;
  layerId?: string;
}) => void;

// ============================================================================
// STAC Layer Control Types
// ============================================================================

/**
 * Information about a STAC asset.
 */
export interface StacAssetInfo {
  /** Asset key in the STAC item. */
  key: string;
  /** URL to the asset. */
  href: string;
  /** Asset MIME type. */
  type: string;
  /** Asset title. */
  title?: string;
  /** Data type from raster:bands (e.g., 'uint8', 'uint16', 'float32'). */
  dataType?: string;
  /** Nodata value from raster:bands. */
  nodata?: number;
  /** Scale factor from raster:bands. */
  scale?: number;
  /** Offset from raster:bands. */
  offset?: number;
  /** Center wavelength in micrometers from eo:bands (for sorting). */
  centerWavelength?: number;
  /** Common band name from eo:bands (e.g., 'blue', 'green', 'red', 'nir'). */
  commonName?: string;
}

/**
 * Options for configuring the StacLayerControl.
 */
export interface StacLayerControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Layer ID to insert layers before. If not specified, layers are added on top. */
  beforeId?: string;
  /** Default STAC item URL to pre-fill. */
  defaultUrl?: string;
  /** Whether to automatically load the defaultUrl when control is added. Default: false. */
  loadDefaultUrl?: boolean;
  /** Default colormap name. Default: 'none'. */
  defaultColormap?: ColormapName | "none";
  /** Default rescale minimum. Default: 0. */
  defaultRescaleMin?: number;
  /** Default rescale maximum. Default: 255. */
  defaultRescaleMax?: number;
  /** Default opacity (0-1). Default: 1. */
  defaultOpacity?: number;
  /** Whether layers are pickable (clickable to show info). Default: true. */
  defaultPickable?: boolean;
  /** Width of the panel in pixels. Default: 320. */
  panelWidth?: number;
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
 * Internal state of the StacLayerControl.
 */
export interface StacLayerControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current STAC item URL. */
  stacUrl: string;
  /** Loaded STAC item. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stacItem: any | null;
  /** Available COG assets from the STAC item. */
  assets: StacAssetInfo[];
  /** Currently selected asset key (single band mode). */
  selectedAsset: string | null;
  /** Whether RGB composite mode is enabled. */
  rgbMode: boolean;
  /** Selected assets for RGB composite [R, G, B]. */
  rgbAssets: [string | null, string | null, string | null];
  /** Current colormap. */
  colormap: ColormapName | "none";
  /** Current rescale min. */
  rescaleMin: number;
  /** Current rescale max. */
  rescaleMax: number;
  /** Current opacity (0-1). */
  layerOpacity: number;
  /** Whether layers are pickable. */
  pickable: boolean;
  /** Whether any layer is currently active. */
  hasLayer: boolean;
  /** Number of active layers. */
  layerCount: number;
  /** Whether the control is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * STAC-specific event types.
 */
export type StacLayerEvent =
  | ComponentEvent
  | "stacload"
  | "layeradd"
  | "layerremove"
  | "error";

/**
 * STAC event handler function type.
 */
export type StacLayerEventHandler = (event: {
  type: StacLayerEvent;
  state: StacLayerControlState;
  url?: string;
  error?: string;
  layerId?: string;
  assetKey?: string;
}) => void;

/**
 * A STAC catalog configuration.
 */
export interface StacCatalog {
  /** Display name of the catalog. */
  name: string;
  /** STAC API endpoint URL. */
  url: string;
}

/**
 * A STAC collection from a catalog.
 */
export interface StacCollection {
  /** Collection ID. */
  id: string;
  /** Collection title. */
  title?: string;
  /** Collection description. */
  description?: string;
}

/**
 * A STAC item from a search result.
 */
export interface StacSearchItem {
  /** Item ID. */
  id: string;
  /** Item datetime. */
  datetime?: string;
  /** Item geometry (GeoJSON). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry?: any;
  /** Item bounding box. */
  bbox?: [number, number, number, number];
  /** Full STAC item URL. */
  selfLink?: string;
  /** Full item properties. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>;
  /** Item assets (bands, data files). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assets?: Record<string, any>;
}

/**
 * Options for configuring the StacSearchControl.
 */
export interface StacSearchControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether the panel starts collapsed (button only). Default: true. */
  collapsed?: boolean;
  /** Width of the panel in pixels. Default: 360. */
  panelWidth?: number;
  /** Maximum height of the panel in pixels. Default: undefined (no limit). */
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
  /** Predefined STAC catalogs. */
  catalogs?: StacCatalog[];
  /** Maximum number of items to return from search. Default: 20. */
  maxItems?: number;
  /** Default rescale minimum for visualization. Default: 0. */
  defaultRescaleMin?: number;
  /** Default rescale maximum for visualization. Default: 10000. */
  defaultRescaleMax?: number;
  /** Default colormap for single band visualization. Default: 'viridis'. */
  defaultColormap?: string;
  /** Whether to start in RGB mode. Default: true. */
  defaultRgbMode?: boolean;
  /** Whether to add search result footprints to the map. Default: true. */
  showFootprints?: boolean;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the StacSearchControl.
 */
export interface StacSearchControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Available catalogs. */
  catalogs: StacCatalog[];
  /** Currently selected catalog. */
  selectedCatalog: StacCatalog | null;
  /** Available collections from the selected catalog. */
  collections: StacCollection[];
  /** Currently selected collection. */
  selectedCollection: StacCollection | null;
  /** Search start date (ISO string). */
  startDate: string | null;
  /** Search end date (ISO string). */
  endDate: string | null;
  /** Maximum items to return. */
  maxItems: number;
  /** Query filter JSON string (e.g., {"eo:cloud_cover": {"lt": 10}}). */
  queryFilter: string;
  /** Search results (items). */
  items: StacSearchItem[];
  /** Currently selected item. */
  selectedItem: StacSearchItem | null;
  /** Rescale min value. */
  rescaleMin: number;
  /** Rescale max value. */
  rescaleMax: number;
  /** Whether in RGB mode (true) or single band mode (false). */
  isRgbMode: boolean;
  /** Selected colormap for single band mode. */
  colormap: string;
  /** Available assets/bands from the selected item. */
  availableAssets: string[];
  /** Selected band for single band mode. */
  selectedBand: string | null;
  /** Selected RGB bands. */
  rgbBands: { r: string | null; g: string | null; b: string | null };
  /** Whether any layer is currently active. */
  hasLayer: boolean;
  /** Whether the control is loading. */
  loading: boolean;
  /** Error message if any. */
  error: string | null;
  /** Status message. */
  status: string | null;
}

/**
 * STAC Search event types.
 */
export type StacSearchEvent =
  | ComponentEvent
  | "catalogselect"
  | "collectionsload"
  | "collectionselect"
  | "search"
  | "itemselect"
  | "display"
  | "error";

/**
 * STAC Search event handler function type.
 */
export type StacSearchEventHandler = (event: {
  type: StacSearchEvent;
  state: StacSearchControlState;
  catalog?: StacCatalog;
  collection?: StacCollection;
  item?: StacSearchItem;
  error?: string;
}) => void;

// ============================================================================
// MeasureControl Types
// ============================================================================

/**
 * Measurement unit for distance.
 */
export type DistanceUnit =
  | "meters"
  | "kilometers"
  | "miles"
  | "feet"
  | "yards"
  | "nautical-miles";

/**
 * Measurement unit for area.
 */
export type AreaUnit =
  | "square-meters"
  | "square-kilometers"
  | "square-miles"
  | "hectares"
  | "acres"
  | "square-feet";

/**
 * Measurement mode.
 */
export type MeasureMode = "distance" | "area";

/**
 * Options for configuring the MeasureControl.
 */
export interface MeasureControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether to start collapsed. Default: true. */
  collapsed?: boolean;
  /** Default measurement mode. Default: 'distance'. */
  defaultMode?: MeasureMode;
  /** Default distance unit. Default: 'kilometers'. */
  distanceUnit?: DistanceUnit;
  /** Default area unit. Default: 'square-kilometers'. */
  areaUnit?: AreaUnit;
  /** Line color for distance measurements. Default: '#3b82f6'. */
  lineColor?: string;
  /** Line width for distance measurements. Default: 3. */
  lineWidth?: number;
  /** Fill color for area measurements. Default: 'rgba(59, 130, 246, 0.2)'. */
  fillColor?: string;
  /** Point color for vertices. Default: '#ef4444'. */
  pointColor?: string;
  /** Point radius for vertices. Default: 6. */
  pointRadius?: number;
  /** Whether to show segment distances. Default: true. */
  showSegments?: boolean;
  /** Whether to show total distance/area label. Default: true. */
  showTotal?: boolean;
  /** Number of decimal places for measurements. Default: 2. */
  precision?: number;
  /** Panel width in pixels. Default: 240. */
  panelWidth?: number;
  /** Background color of the panel. Default: 'rgba(255, 255, 255, 0.95)'. */
  backgroundColor?: string;
  /** Border radius in pixels. Default: 4. */
  borderRadius?: number;
  /** Opacity of the control (0-1). Default: 1. */
  opacity?: number;
  /** Font size in pixels. Default: 12. */
  fontSize?: number;
  /** Font color. Default: '#333'. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * A single measurement point.
 */
export interface MeasurePoint {
  /** Longitude. */
  lng: number;
  /** Latitude. */
  lat: number;
}

/**
 * A completed measurement.
 */
export interface Measurement {
  /** Unique identifier. */
  id: string;
  /** Measurement mode. */
  mode: MeasureMode;
  /** Points that define the measurement. */
  points: MeasurePoint[];
  /** Total distance in meters (for distance mode). */
  distance?: number;
  /** Total area in square meters (for area mode). */
  area?: number;
  /** Segment distances in meters. */
  segments?: number[];
}

/**
 * Internal state of the MeasureControl.
 */
export interface MeasureControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current measurement mode. */
  mode: MeasureMode;
  /** Current distance unit. */
  distanceUnit: DistanceUnit;
  /** Current area unit. */
  areaUnit: AreaUnit;
  /** Whether currently drawing a measurement. */
  isDrawing: boolean;
  /** Current drawing points. */
  currentPoints: MeasurePoint[];
  /** Current measurement value (distance or area). */
  currentValue: number;
  /** Segment distances for current drawing. */
  currentSegments: number[];
  /** Completed measurements. */
  measurements: Measurement[];
}

/**
 * MeasureControl event types.
 */
export type MeasureEvent =
  | ComponentEvent
  | "modechange"
  | "unitchange"
  | "drawstart"
  | "drawupdate"
  | "drawend"
  | "clear"
  | "measurementadd"
  | "measurementremove";

/**
 * MeasureControl event handler function type.
 */
export type MeasureEventHandler = (event: {
  type: MeasureEvent;
  state: MeasureControlState;
  measurement?: Measurement;
}) => void;

// ============================================================================
// SplitMapControl Types
// ============================================================================

/**
 * Split orientation.
 */
export type SplitOrientation = "vertical" | "horizontal";

/**
 * Options for configuring the SplitMapControl.
 */
export interface SplitMapControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Split orientation. Default: 'vertical'. */
  orientation?: SplitOrientation;
  /** Initial split position (0-1). Default: 0.5. */
  initialPosition?: number;
  /** Left/top layer ID. */
  leftLayer?: string;
  /** Right/bottom layer ID. */
  rightLayer?: string;
  /** Swiper line color. Default: '#ffffff'. */
  swiperColor?: string;
  /** Swiper line width. Default: 4. */
  swiperWidth?: number;
  /** Swiper handle size. Default: 40. */
  handleSize?: number;
  /** Whether to show layer labels. Default: true. */
  showLabels?: boolean;
  /** Label for left/top layer. Default: 'Before'. */
  leftLabel?: string;
  /** Label for right/bottom layer. Default: 'After'. */
  rightLabel?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the SplitMapControl.
 */
export interface SplitMapControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the split mode is active. */
  active: boolean;
  /** Current split position (0-1). */
  position: number;
  /** Split orientation. */
  orientation: SplitOrientation;
  /** Left layer ID. */
  leftLayer: string | null;
  /** Right layer ID. */
  rightLayer: string | null;
}

/**
 * SplitMapControl event types.
 */
export type SplitMapEvent =
  | ComponentEvent
  | "activate"
  | "deactivate"
  | "positionchange"
  | "layerchange";

/**
 * SplitMapControl event handler function type.
 */
export type SplitMapEventHandler = (event: {
  type: SplitMapEvent;
  state: SplitMapControlState;
}) => void;

// ============================================================================
// BookmarkControl Types
// ============================================================================

/**
 * A saved map bookmark/view.
 */
export interface MapBookmark {
  /** Unique identifier. */
  id: string;
  /** Bookmark name. */
  name: string;
  /** Center longitude. */
  lng: number;
  /** Center latitude. */
  lat: number;
  /** Zoom level. */
  zoom: number;
  /** Pitch (tilt). */
  pitch: number;
  /** Bearing (rotation). */
  bearing: number;
  /** Timestamp when created. */
  createdAt: number;
  /** Optional thumbnail data URL. */
  thumbnail?: string;
}

/**
 * Options for configuring the BookmarkControl.
 */
export interface BookmarkControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether to start collapsed. Default: true. */
  collapsed?: boolean;
  /** Initial bookmarks. Default: []. */
  bookmarks?: MapBookmark[];
  /** localStorage key for persistence. Default: null (no persistence). */
  storageKey?: string;
  /** Maximum number of bookmarks. Default: 20. */
  maxBookmarks?: number;
  /** Whether to generate thumbnails. Default: false. */
  generateThumbnails?: boolean;
  /** Fly-to animation duration in ms. Default: 1500. */
  flyToDuration?: number;
  /** Panel width in pixels. Default: 260. */
  panelWidth?: number;
  /** Background color. Default: 'rgba(255, 255, 255, 0.95)'. */
  backgroundColor?: string;
  /** Border radius in pixels. Default: 4. */
  borderRadius?: number;
  /** Font size in pixels. Default: 12. */
  fontSize?: number;
  /** Font color. Default: '#333'. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the BookmarkControl.
 */
export interface BookmarkControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Saved bookmarks. */
  bookmarks: MapBookmark[];
  /** Currently selected bookmark ID. */
  selectedId: string | null;
}

/**
 * BookmarkControl event types.
 */
export type BookmarkEvent =
  | ComponentEvent
  | "add"
  | "remove"
  | "select"
  | "rename"
  | "clear"
  | "import";

/**
 * BookmarkControl event handler function type.
 */
export type BookmarkEventHandler = (event: {
  type: BookmarkEvent;
  state: BookmarkControlState;
  bookmark?: MapBookmark;
}) => void;

// ============================================================================
// PrintControl Types
// ============================================================================

/**
 * Options for configuring the PrintControl.
 */
export interface PrintControlOptions {
  /** Position on the map. Default: 'top-right'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether to start collapsed. Default: true. */
  collapsed?: boolean;
  /** Default image format. Default: 'png'. */
  format?: "png" | "jpeg" | "pdf";
  /** JPEG quality (0-1). Default: 0.92. */
  quality?: number;
  /** Default filename (without extension). Default: 'map-export'. */
  filename?: string;
  /** Optional title text rendered on the exported image. */
  title?: string;
  /** Title font size in pixels. Default: 24. */
  titleFontSize?: number;
  /** Title font color. Default: '#333333'. */
  titleFontColor?: string;
  /** Title background. Default: 'rgba(255,255,255,0.8)'. */
  titleBackground?: string;
  /** Whether to show size options (Current/Custom). Default: false. */
  showSizeOptions?: boolean;
  /** Width override for export (pixels). If not set, uses current canvas size. */
  width?: number;
  /** Height override for export (pixels). If not set, uses current canvas size. */
  height?: number;
  /** Panel width in pixels. Default: 280. */
  panelWidth?: number;
  /** Background color of the panel. Default: 'rgba(255, 255, 255, 0.95)'. */
  backgroundColor?: string;
  /** Border radius in pixels. Default: 4. */
  borderRadius?: number;
  /** Opacity of the control (0-1). Default: 1. */
  opacity?: number;
  /** Font size in pixels. Default: 12. */
  fontSize?: number;
  /** Font color. Default: '#333'. */
  fontColor?: string;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the PrintControl.
 */
export interface PrintControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the panel is collapsed. */
  collapsed: boolean;
  /** Current image format. */
  format: "png" | "jpeg" | "pdf";
  /** JPEG quality (0-1). */
  quality: number;
  /** Current filename (without extension). */
  filename: string;
  /** Title text for export. */
  title: string;
  /** Whether an export is in progress. */
  exporting: boolean;
  /** Custom width (null = use current canvas size). */
  width: number | null;
  /** Custom height (null = use current canvas size). */
  height: number | null;
}

/**
 * PrintControl event types.
 */
export type PrintEvent = ComponentEvent | "export" | "copy" | "error";

/**
 * PrintControl event handler function type.
 */
export type PrintEventHandler = (event: {
  type: PrintEvent;
  state: PrintControlState;
  dataUrl?: string;
  error?: string;
}) => void;

// ============================================================================
// MinimapControl Types
// ============================================================================

/**
 * Options for configuring the MinimapControl.
 */
export interface MinimapControlOptions {
  /** Position on the map. Default: 'bottom-left'. */
  position?: ControlPosition;
  /** Custom CSS class name. */
  className?: string;
  /** Whether the control is initially visible. Default: true. */
  visible?: boolean;
  /** Whether to start collapsed (minimap hidden). Default: false. */
  collapsed?: boolean;
  /** Width of the minimap in pixels. Default: 250. */
  width?: number;
  /** Height of the minimap in pixels. Default: 180. */
  height?: number;
  /** Zoom offset relative to the main map. Default: -5. */
  zoomOffset?: number;
  /** Style for the minimap. Can be a StyleSpecification object or a URL string. */
  style?: string | object;
  /** Color of the viewport rectangle outline. Default: '#0078d7'. */
  viewportRectColor?: string;
  /** Opacity of the viewport rectangle fill. Default: 0.2. */
  viewportRectOpacity?: number;
  /** Whether the minimap can be toggled. Default: true. */
  toggleable?: boolean;
  /** Whether the minimap is interactive (click to navigate). Default: false. */
  interactive?: boolean;
  /** Minimum zoom level at which the control is visible. */
  minzoom?: number;
  /** Maximum zoom level at which the control is visible. */
  maxzoom?: number;
}

/**
 * Internal state of the MinimapControl.
 */
export interface MinimapControlState {
  /** Whether the control is visible. */
  visible: boolean;
  /** Whether the minimap panel is collapsed. */
  collapsed: boolean;
}

/**
 * Props for the React MinimapControl wrapper component.
 */
export interface MinimapControlReactProps extends MinimapControlOptions {
  /** MapLibre GL map instance. */
  map: Map;
  /** Callback fired when state changes. */
  onStateChange?: (state: MinimapControlState) => void;
}

/**
 * MinimapControl event types.
 */
export type MinimapEvent = ComponentEvent;

/**
 * MinimapControl event handler function type.
 */
export type MinimapEventHandler = (event: {
  type: MinimapEvent;
  state: MinimapControlState;
}) => void;

