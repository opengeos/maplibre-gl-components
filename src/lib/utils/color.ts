import type { ColorStop } from "../core/types";

/**
 * Converts a hex color to RGB values.
 *
 * @param hex - The hex color string (with or without #).
 * @returns Object with r, g, b values (0-255).
 */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converts RGB values to a hex color string.
 *
 * @param r - Red value (0-255).
 * @param g - Green value (0-255).
 * @param b - Blue value (0-255).
 * @returns Hex color string with #.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Interpolates between two colors.
 *
 * @param color1 - First hex color.
 * @param color2 - Second hex color.
 * @param factor - Interpolation factor (0-1).
 * @returns Interpolated hex color.
 */
export function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return color1;
  }

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);

  return rgbToHex(r, g, b);
}

/**
 * Gets a color from a colormap at a specific position.
 *
 * @param colorStops - Array of color stops.
 * @param position - Position (0-1) to sample.
 * @returns The interpolated color at the position.
 */
export function getColorAtPosition(
  colorStops: ColorStop[],
  position: number,
): string {
  // Clamp position to valid range
  const pos = Math.max(0, Math.min(1, position));

  // Find surrounding color stops
  let lower = colorStops[0];
  let upper = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (colorStops[i].position <= pos && colorStops[i + 1].position >= pos) {
      lower = colorStops[i];
      upper = colorStops[i + 1];
      break;
    }
  }

  // Handle edge cases
  if (pos <= lower.position) return lower.color;
  if (pos >= upper.position) return upper.color;

  // Interpolate
  const range = upper.position - lower.position;
  const factor = range === 0 ? 0 : (pos - lower.position) / range;

  return interpolateColor(lower.color, upper.color, factor);
}

/**
 * Generates CSS gradient string from color stops.
 *
 * @param colorStops - Array of color stops.
 * @param direction - CSS gradient direction.
 * @returns CSS linear-gradient string.
 */
export function generateGradientCSS(
  colorStops: ColorStop[],
  direction: string = "to right",
): string {
  const stops = colorStops
    .map((stop) => `${stop.color} ${stop.position * 100}%`)
    .join(", ");
  return `linear-gradient(${direction}, ${stops})`;
}
