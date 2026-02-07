import type { ColorStop, ColormapName } from "../core/types";
import { viridis, plasma, inferno, magma, cividis } from "./sequential";
import {
  coolwarm,
  bwr,
  seismic,
  RdBu,
  RdYlBu,
  RdYlGn,
  spectral,
} from "./diverging";
import {
  jet,
  rainbow,
  turbo,
  terrain,
  ocean,
  hot,
  cool,
  gray,
  bone,
} from "./misc";

/**
 * Map of all built-in colormaps.
 */
export const COLORMAPS: Record<ColormapName, ColorStop[]> = {
  // Sequential
  viridis,
  plasma,
  inferno,
  magma,
  cividis,
  // Diverging
  coolwarm,
  bwr,
  seismic,
  RdBu,
  RdYlBu,
  RdYlGn,
  spectral,
  // Miscellaneous
  jet,
  rainbow,
  turbo,
  terrain,
  ocean,
  hot,
  cool,
  gray,
  bone,
};

/**
 * Gets a colormap by name.
 *
 * @param name - The colormap name.
 * @returns Array of color stops.
 */
export function getColormap(name: ColormapName): ColorStop[] {
  return COLORMAPS[name] || COLORMAPS.viridis;
}

/**
 * Checks if a colormap name is valid.
 *
 * @param name - The name to check.
 * @returns True if the name is a valid colormap.
 */
export function isValidColormap(name: string): name is ColormapName {
  return name in COLORMAPS;
}

/**
 * Gets all available colormap names.
 *
 * @returns Array of colormap names.
 */
export function getColormapNames(): ColormapName[] {
  return Object.keys(COLORMAPS) as ColormapName[];
}

// Re-export individual colormaps
export { viridis, plasma, inferno, magma, cividis };
export { coolwarm, bwr, seismic, RdBu, RdYlBu, RdYlGn, spectral };
export { jet, rainbow, turbo, terrain, ocean, hot, cool, gray, bone };
