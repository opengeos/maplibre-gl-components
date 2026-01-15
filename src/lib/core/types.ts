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
