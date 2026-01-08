// React entry point
export { ColorbarReact } from './lib/core/ColorbarReact';
export { LegendReact } from './lib/core/LegendReact';
export { HtmlControlReact } from './lib/core/HtmlControlReact';

// React hooks
export { useColorbar, useLegend, useHtmlControl } from './lib/hooks';

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
  ColormapName,
  ColorStop,
  ControlPosition,
  ColorbarOrientation,
  ComponentEvent,
  ComponentEventHandler,
} from './lib/core/types';
