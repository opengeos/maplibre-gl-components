// React entry point
export { ColorbarReact } from './lib/core/ColorbarReact';
export { LegendReact } from './lib/core/LegendReact';
export { HtmlControlReact } from './lib/core/HtmlControlReact';
export { BasemapReact } from './lib/core/BasemapReact';
export { TerrainReact } from './lib/core/TerrainReact';

// React hooks
export { useColorbar, useLegend, useHtmlControl, useBasemap, useTerrain } from './lib/hooks';

// Re-export types for React consumers
export type {
  ColorbarOptions,
  ColorbarState,
  ColorbarReactProps,
  LegendOptions,
  LegendState,
  LegendReactProps,
  LegendItem,
  HtmlControlOptions,
  HtmlControlState,
  HtmlControlReactProps,
  BasemapControlOptions,
  BasemapControlState,
  BasemapControlReactProps,
  BasemapItem,
  BasemapDisplayMode,
  BasemapEvent,
  TerrainControlOptions,
  TerrainControlState,
  TerrainControlReactProps,
  TerrainEncoding,
  TerrainEvent,
  TerrainEventHandler,
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  ComponentEvent,
  ComponentEventHandler,
} from './lib/core/types';
