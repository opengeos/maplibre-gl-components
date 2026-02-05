// React entry point
export { ColorbarReact } from './lib/core/ColorbarReact';
export { LegendReact } from './lib/core/LegendReact';
export { HtmlControlReact } from './lib/core/HtmlControlReact';
export { BasemapReact } from './lib/core/BasemapReact';
export { TerrainReact } from './lib/core/TerrainReact';
export { SearchControlReact } from './lib/core/SearchControlReact';
export { VectorDatasetReact } from './lib/core/VectorDatasetReact';
export { InspectControlReact } from './lib/core/InspectControlReact';
export { ViewStateControlReact } from './lib/core/ViewStateControlReact';

// React hooks
export {
  useColorbar,
  useLegend,
  useHtmlControl,
  useBasemap,
  useTerrain,
  useSearchControl,
  useVectorDataset,
  useInspectControl,
  useViewState,
} from './lib/hooks';

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
  SearchControlOptions,
  SearchControlState,
  SearchControlReactProps,
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
  InspectControlReactProps,
  InspectedFeature,
  InspectHighlightStyle,
  InspectEvent,
  InspectEventHandler,
  ViewStateControlOptions,
  ViewStateControlState,
  ViewStateControlReactProps,
  ViewStateEvent,
  ViewStateEventHandler,
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  ComponentEvent,
  ComponentEventHandler,
} from './lib/core/types';
