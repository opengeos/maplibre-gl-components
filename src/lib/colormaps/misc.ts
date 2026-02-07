import type { ColorStop } from "../core/types";

/**
 * Jet colormap (classic rainbow-like).
 */
export const jet: ColorStop[] = [
  { position: 0.0, color: "#00007f" },
  { position: 0.125, color: "#0000ff" },
  { position: 0.25, color: "#007fff" },
  { position: 0.375, color: "#00ffff" },
  { position: 0.5, color: "#7fff7f" },
  { position: 0.625, color: "#ffff00" },
  { position: 0.75, color: "#ff7f00" },
  { position: 0.875, color: "#ff0000" },
  { position: 1.0, color: "#7f0000" },
];

/**
 * Rainbow colormap.
 */
export const rainbow: ColorStop[] = [
  { position: 0.0, color: "#ff0000" },
  { position: 0.17, color: "#ff8000" },
  { position: 0.33, color: "#ffff00" },
  { position: 0.5, color: "#00ff00" },
  { position: 0.67, color: "#00ffff" },
  { position: 0.83, color: "#0000ff" },
  { position: 1.0, color: "#8000ff" },
];

/**
 * Turbo colormap (improved rainbow).
 */
export const turbo: ColorStop[] = [
  { position: 0.0, color: "#30123b" },
  { position: 0.1, color: "#4662d7" },
  { position: 0.2, color: "#36aaf9" },
  { position: 0.3, color: "#1ae4b6" },
  { position: 0.4, color: "#72fe5e" },
  { position: 0.5, color: "#c8ef34" },
  { position: 0.6, color: "#faba39" },
  { position: 0.7, color: "#f66b19" },
  { position: 0.8, color: "#ca2a04" },
  { position: 0.9, color: "#7a0403" },
  { position: 1.0, color: "#7a0403" },
];

/**
 * Terrain colormap.
 */
export const terrain: ColorStop[] = [
  { position: 0.0, color: "#333399" },
  { position: 0.15, color: "#0099cc" },
  { position: 0.25, color: "#00cc99" },
  { position: 0.35, color: "#99cc00" },
  { position: 0.5, color: "#ffcc00" },
  { position: 0.65, color: "#cc6600" },
  { position: 0.75, color: "#993300" },
  { position: 0.85, color: "#996633" },
  { position: 1.0, color: "#ffffff" },
];

/**
 * Ocean colormap.
 */
export const ocean: ColorStop[] = [
  { position: 0.0, color: "#007f00" },
  { position: 0.25, color: "#00007f" },
  { position: 0.5, color: "#0000ff" },
  { position: 0.75, color: "#7fffff" },
  { position: 1.0, color: "#ffffff" },
];

/**
 * Hot colormap (black-red-yellow-white).
 */
export const hot: ColorStop[] = [
  { position: 0.0, color: "#000000" },
  { position: 0.33, color: "#ff0000" },
  { position: 0.67, color: "#ffff00" },
  { position: 1.0, color: "#ffffff" },
];

/**
 * Cool colormap (cyan-magenta).
 */
export const cool: ColorStop[] = [
  { position: 0.0, color: "#00ffff" },
  { position: 1.0, color: "#ff00ff" },
];

/**
 * Gray/Grayscale colormap.
 */
export const gray: ColorStop[] = [
  { position: 0.0, color: "#000000" },
  { position: 1.0, color: "#ffffff" },
];

/**
 * Bone colormap.
 */
export const bone: ColorStop[] = [
  { position: 0.0, color: "#000000" },
  { position: 0.375, color: "#545474" },
  { position: 0.75, color: "#a9c8c8" },
  { position: 1.0, color: "#ffffff" },
];
