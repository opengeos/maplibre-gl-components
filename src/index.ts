// Import styles
import './lib/styles/common.css';
import './lib/styles/colorbar.css';
import './lib/styles/legend.css';
import './lib/styles/html-control.css';
import './lib/styles/basemap.css';
import './lib/styles/terrain.css';
import './lib/styles/search-control.css';
import './lib/styles/vector-dataset.css';
import './lib/styles/inspect-control.css';

// Main entry point - Core exports
export { Colorbar } from './lib/core/Colorbar';
export { Legend } from './lib/core/Legend';
export { HtmlControl } from './lib/core/HtmlControl';
export { BasemapControl } from './lib/core/Basemap';
export { TerrainControl } from './lib/core/Terrain';
export { SearchControl } from './lib/core/SearchControl';
export { VectorDatasetControl } from './lib/core/VectorDataset';
export { InspectControl } from './lib/core/InspectControl';

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
} from './lib/utils/providers';

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
} from './lib/colormaps';

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
} from './lib/utils';

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
  InspectControlOptions,
  InspectControlState,
  InspectedFeature,
  InspectHighlightStyle,
  InspectEvent,
  InspectEventHandler,
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  TickConfig,
  ComponentEvent,
  ComponentEventHandler,
  ColormapDefinition,
} from './lib/core/types';
