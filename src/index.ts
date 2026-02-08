// Import styles
import "./lib/styles/common.css";
import "./lib/styles/colorbar.css";
import "./lib/styles/legend.css";
import "./lib/styles/html-control.css";
import "./lib/styles/basemap.css";
import "./lib/styles/terrain.css";
import "./lib/styles/search-control.css";
import "./lib/styles/vector-dataset.css";
import "./lib/styles/inspect-control.css";
import "./lib/styles/view-state.css";
import "./lib/styles/control-grid.css";
import "./lib/styles/cog-layer.css";
import "./lib/styles/zarr-layer.css";
import "./lib/styles/pmtiles-layer.css";
import "./lib/styles/add-vector.css";
import "./lib/styles/stac-layer.css";
import "./lib/styles/stac-search.css";
import "./lib/styles/measure-control.css";
import "./lib/styles/bookmark-control.css";

// Main entry point - Core exports
export { Colorbar } from "./lib/core/Colorbar";
export { Legend } from "./lib/core/Legend";
export { HtmlControl } from "./lib/core/HtmlControl";
export { BasemapControl } from "./lib/core/Basemap";
export { TerrainControl } from "./lib/core/Terrain";
export { SearchControl } from "./lib/core/SearchControl";
export { VectorDatasetControl } from "./lib/core/VectorDataset";
export { InspectControl } from "./lib/core/InspectControl";
export { ViewStateControl } from "./lib/core/ViewStateControl";
export { ControlGrid } from "./lib/core/ControlGrid";
export { CogLayerControl } from "./lib/core/CogLayer";
export { ZarrLayerControl } from "./lib/core/ZarrLayer";
export { PMTilesLayerControl } from "./lib/core/PMTilesLayer";
export { AddVectorControl } from "./lib/core/AddVector";
export { StacLayerControl } from "./lib/core/StacLayer";
export { StacSearchControl } from "./lib/core/StacSearch";
export { MeasureControl } from "./lib/core/MeasureControl";
export { BookmarkControl } from "./lib/core/BookmarkControl";

// Adapters for layer control integration
export {
  CogLayerAdapter,
  ZarrLayerAdapter,
  PMTilesLayerAdapter,
  AddVectorAdapter,
} from "./lib/adapters";
export type { CustomLayerAdapter } from "./lib/adapters";

// Provider utilities
export {
  XYZSERVICES_URL,
  GOOGLE_BASEMAPS,
  buildTileUrl,
  generateThumbnailUrl,
  parseProviders,
  fetchProviders,
  groupBasemaps,
  filterBasemaps,
} from "./lib/utils/providers";

// Colormap exports
export {
  getColormap,
  isValidColormap,
  getColormapNames,
  COLORMAPS,
  viridis,
  plasma,
  inferno,
  magma,
  cividis,
  coolwarm,
  bwr,
  seismic,
  RdBu,
  RdYlBu,
  RdYlGn,
  spectral,
  jet,
  rainbow,
  turbo,
  terrain,
  ocean,
  hot,
  cool,
  gray,
  bone,
} from "./lib/colormaps";

// Utility exports
export {
  hexToRgb,
  rgbToHex,
  interpolateColor,
  getColorAtPosition,
  generateGradientCSS,
  clamp,
  formatNumericValue,
  generateId,
  debounce,
  throttle,
  classNames,
} from "./lib/utils";

// File helper exports
export {
  detectFormat,
  requiresDuckDB,
  requiresConversion,
  getAcceptedExtensions,
  isValidExtension,
  getFormatDisplayName,
  getFormatDescription,
  getFileExtension,
  readFileAsBuffer,
  GEOJSON_EXTENSIONS,
  SHAPEFILE_EXTENSIONS,
  GEOPACKAGE_EXTENSIONS,
  GEOPARQUET_EXTENSIONS,
  KML_EXTENSIONS,
  KMZ_EXTENSIONS,
  GPX_EXTENSIONS,
  FLATGEOBUF_EXTENSIONS,
  GML_EXTENSIONS,
  TOPOJSON_EXTENSIONS,
  CSV_EXTENSIONS,
  XLSX_EXTENSIONS,
  DXF_EXTENSIONS,
  SHPJS_EXTENSIONS,
  DUCKDB_EXTENSIONS,
  ADVANCED_EXTENSIONS,
  ALL_EXTENSIONS,
} from "./lib/utils/fileHelpers";

// Converter exports
export {
  getDuckDBConverter,
  DuckDBConverter,
  getShapefileConverter,
  ShapefileConverter,
} from "./lib/converters";

// Type exports
export type {
  ColorbarOptions,
  ColorbarState,
  LegendOptions,
  LegendState,
  LegendItem,
  HtmlControlOptions,
  HtmlControlState,
  BasemapControlOptions,
  BasemapControlState,
  BasemapItem,
  BasemapDisplayMode,
  BasemapEvent,
  TerrainControlOptions,
  TerrainControlState,
  TerrainEncoding,
  TerrainEvent,
  TerrainEventHandler,
  SearchControlOptions,
  SearchControlState,
  SearchResult,
  SearchEvent,
  SearchEventHandler,
  VectorDatasetControlOptions,
  VectorDatasetControlState,
  VectorDatasetControlReactProps,
  LoadedDataset,
  VectorLayerStyle,
  VectorDatasetEvent,
  VectorDatasetEventHandler,
  VectorFormat,
  ConversionProgress,
  ConversionProgressCallback,
  InspectControlOptions,
  InspectControlState,
  InspectedFeature,
  InspectHighlightStyle,
  InspectEvent,
  InspectEventHandler,
  ViewStateControlOptions,
  ViewStateControlState,
  ViewStateEvent,
  ViewStateEventHandler,
  ControlGridOptions,
  ControlGridState,
  DefaultControlName,
  ControlGridReactProps,
  ControlGridEvent,
  ControlGridEventHandler,
  CogLayerControlOptions,
  CogLayerControlState,
  CogLayerEvent,
  CogLayerEventHandler,
  CogLayerInfo,
  ZarrLayerControlOptions,
  ZarrLayerControlState,
  ZarrLayerEvent,
  ZarrLayerEventHandler,
  ZarrLayerInfo,
  PMTilesLayerControlOptions,
  PMTilesLayerControlState,
  PMTilesLayerEvent,
  PMTilesLayerEventHandler,
  PMTilesLayerInfo,
  PMTilesTileType,
  AddVectorControlOptions,
  AddVectorControlState,
  AddVectorEvent,
  AddVectorEventHandler,
  AddVectorLayerInfo,
  RemoteVectorFormat,
  StacLayerControlOptions,
  StacLayerControlState,
  StacLayerEvent,
  StacLayerEventHandler,
  StacAssetInfo,
  StacSearchControlOptions,
  StacSearchControlState,
  StacSearchEvent,
  StacSearchEventHandler,
  StacCatalog,
  StacCollection,
  StacSearchItem,
  MeasureControlOptions,
  MeasureControlState,
  MeasureEvent,
  MeasureEventHandler,
  MeasureMode,
  MeasurePoint,
  Measurement,
  DistanceUnit,
  AreaUnit,
  BookmarkControlOptions,
  BookmarkControlState,
  BookmarkEvent,
  BookmarkEventHandler,
  MapBookmark,
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  TickConfig,
  ComponentEvent,
  ComponentEventHandler,
  ColormapDefinition,
} from "./lib/core/types";

// Converter types
export type {
  ConversionResult,
  ConversionMetadata,
  VectorConverter,
} from "./lib/converters";
