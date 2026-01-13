// Import styles
import './lib/styles/common.css';
import './lib/styles/colorbar.css';
import './lib/styles/legend.css';
import './lib/styles/html-control.css';
import './lib/styles/basemap.css';

// Main entry point - Core exports
export { Colorbar } from './lib/core/Colorbar';
export { Legend } from './lib/core/Legend';
export { HtmlControl } from './lib/core/HtmlControl';
export { BasemapControl } from './lib/core/Basemap';

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
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  TickConfig,
  ComponentEvent,
  ComponentEventHandler,
  ColormapDefinition,
} from './lib/core/types';
