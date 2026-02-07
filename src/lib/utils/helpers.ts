/**
 * Clamps a value between min and max.
 *
 * @param value - The value to clamp.
 * @param min - The minimum value.
 * @param max - The maximum value.
 * @returns The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats a numeric value based on the range.
 *
 * @param value - The value to format.
 * @param range - The total range (max - min).
 * @returns Formatted string.
 */
export function formatNumericValue(value: number, range: number): string {
  if (range >= 100) {
    return Math.round(value).toString();
  } else if (range >= 1) {
    return value.toFixed(1);
  } else if (range >= 0.1) {
    return value.toFixed(2);
  } else {
    return value.toFixed(3);
  }
}

/**
 * Generates a unique ID with optional prefix.
 *
 * @param prefix - Optional prefix for the ID.
 * @returns A unique ID string.
 */
export function generateId(prefix = "mlgl"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Debounces a function call.
 *
 * @param fn - The function to debounce.
 * @param delay - The delay in milliseconds.
 * @returns A debounced function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttles a function call.
 *
 * @param fn - The function to throttle.
 * @param limit - The minimum time between calls in milliseconds.
 * @returns A throttled function.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Joins class names, filtering out falsy values.
 *
 * @param classes - Class names to join.
 * @returns Joined class string.
 */
export function classNames(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}
