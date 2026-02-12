import type { Map as MapLibreMap } from "maplibre-gl";
import { ControlGrid } from "./core/ControlGrid";
import type { DefaultControlName, ControlGridOptions } from "./core/types";

/**
 * All available default control names, in recommended display order.
 */
export const ALL_DEFAULT_CONTROLS: readonly DefaultControlName[] = [
  "globe",
  "fullscreen",
  "north",
  "terrain",
  "search",
  "viewState",
  "inspect",
  "vectorDataset",
  "basemap",
  "measure",
  "geoEditor",
  "bookmark",
  "print",
  "minimap",
  "swipe",
  "streetView",
  "addVector",
  "cogLayer",
  "zarrLayer",
  "pmtilesLayer",
  "stacLayer",
  "stacSearch",
  "planetaryComputer",
  "gaussianSplat",
  "lidar",
  "usgsLidar",
] as const;

/**
 * Default layer ID patterns to exclude from SwipeControl layer list.
 * These match internal/helper layers added by various controls.
 */
export const DEFAULT_EXCLUDE_LAYERS: readonly string[] = [
  "usgs-lidar-*",
  "lidar-*",
  "mapbox-gl-draw-*",
  "gl-draw-*",
  "gm_*",
  "inspect-highlight-*",
  "measure-*",
];

/**
 * Options for the addControlGrid convenience function.
 * Extends ControlGridOptions with an `exclude` field for filtering default controls.
 */
export interface AddControlGridOptions extends ControlGridOptions {
  /**
   * Controls to exclude from the default set.
   * Only used when `defaultControls` is not explicitly provided.
   *
   * @example
   * ```typescript
   * addControlGrid(map, { exclude: ['minimap', 'streetView'] });
   * ```
   */
  exclude?: DefaultControlName[];
}

/**
 * Compute a near-square grid layout for a given number of items.
 */
function computeGridDimensions(count: number): {
  rows: number;
  columns: number;
} {
  if (count <= 0) return { rows: 1, columns: 1 };
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return { rows, columns };
}

/**
 * Add a ControlGrid with sensible defaults to a MapLibre map.
 *
 * With no arguments, adds all 26 default controls in a near-square grid.
 * Customize by providing `exclude` to remove specific controls, or
 * `defaultControls` to specify an explicit list.
 *
 * @param map - The MapLibre GL map instance.
 * @param options - Optional configuration. All `ControlGridOptions` fields
 *   are supported, plus `exclude` for filtering.
 * @returns The ControlGrid instance (useful for `getAdapters()`, `on()`, etc.).
 *
 * @example
 * ```typescript
 * // All defaults
 * const grid = addControlGrid(map);
 *
 * // Exclude specific controls
 * const grid = addControlGrid(map, {
 *   exclude: ['minimap', 'streetView'],
 *   basemapStyleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
 * });
 *
 * // Only specific controls
 * const grid = addControlGrid(map, {
 *   defaultControls: ['search', 'basemap', 'terrain'],
 * });
 * ```
 */
export function addControlGrid(
  map: MapLibreMap,
  options?: AddControlGridOptions,
): ControlGrid {
  const { exclude, ...gridOptions } = options ?? {};

  // Determine which controls to use
  if (gridOptions.defaultControls === undefined) {
    const excludeSet = new Set(exclude ?? []);
    gridOptions.defaultControls = ALL_DEFAULT_CONTROLS.filter(
      (name) => !excludeSet.has(name),
    );
  }

  const controlCount = gridOptions.defaultControls.length;

  // Auto-calculate grid dimensions if not provided
  if (gridOptions.rows === undefined && gridOptions.columns === undefined) {
    const dims = computeGridDimensions(controlCount);
    gridOptions.rows = dims.rows;
    gridOptions.columns = dims.columns;
  } else if (
    gridOptions.rows === undefined &&
    gridOptions.columns !== undefined
  ) {
    gridOptions.rows = Math.ceil(controlCount / gridOptions.columns);
  } else if (
    gridOptions.columns === undefined &&
    gridOptions.rows !== undefined
  ) {
    gridOptions.columns = Math.ceil(controlCount / gridOptions.rows);
  }

  // Apply sensible defaults
  gridOptions.position ??= "top-right";
  gridOptions.collapsible ??= true;
  gridOptions.collapsed ??= true;
  gridOptions.showRowColumnControls ??= true;
  gridOptions.gap ??= 2;
  gridOptions.excludeLayers ??= [...DEFAULT_EXCLUDE_LAYERS];

  const controlGrid = new ControlGrid(gridOptions);
  map.addControl(controlGrid, gridOptions.position);
  return controlGrid;
}

// ---------------------------------------------------------------------------
// Map prototype extension
// ---------------------------------------------------------------------------

declare module "maplibre-gl" {
  interface Map {
    /**
     * Add a ControlGrid with sensible defaults.
     *
     * Convenience method that creates a ControlGrid with all (or filtered)
     * default controls and adds it to the map.
     *
     * @param options - Optional configuration (see `AddControlGridOptions`).
     * @returns The ControlGrid instance.
     */
    addControlGrid(options?: AddControlGridOptions): ControlGrid;
  }
}

/**
 * Install the `addControlGrid` method on the MapLibre `Map` prototype.
 * This is called automatically when importing from `maplibre-gl-components`.
 */
export function installAddControlGrid(
  MapClass: { prototype: MapLibreMap },
): void {
  if (
    !(MapClass.prototype as MapLibreMap & Record<string, unknown>)
      .addControlGrid
  ) {
    (
      MapClass.prototype as MapLibreMap & { addControlGrid?: unknown }
    ).addControlGrid = function (
      this: MapLibreMap,
      options?: AddControlGridOptions,
    ): ControlGrid {
      return addControlGrid(this, options);
    };
  }
}
