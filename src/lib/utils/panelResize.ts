import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Smallest user-resized panel footprint, in pixels.
 */
export const PANEL_MIN_WIDTH = 260;
export const PANEL_MIN_HEIGHT = 180;
/**
 * Breathing room kept between a resized panel and the map edges, in pixels.
 */
export const PANEL_EDGE_MARGIN = 12;

/**
 * The shared CSS class for the custom corner resize handles. Both bottom-corner
 * grips carry this base class plus a side modifier so every floating panel gets
 * the same styling.
 */
export const PANEL_RESIZE_HANDLE_CLASS = "maplibre-gl-panel-resize-handle";
export const PANEL_RESIZE_LEFT_CLASS = "maplibre-gl-panel-resize-left";
export const PANEL_RESIZE_RIGHT_CLASS = "maplibre-gl-panel-resize-right";

/**
 * A persisted, user-chosen panel size from the resize handle.
 */
export interface UserPanelSize {
  width: number;
  height: number;
}

/**
 * Reads the map's container element defensively. The real MapLibre map always
 * exposes `getContainer`, but a partial test mock may not, so this returns
 * undefined rather than throwing when the method is missing.
 *
 * @param map - The MapLibre map instance, or undefined.
 * @returns The map container element, or undefined when unavailable.
 */
function getMapContainer(
  map: MapLibreMap | undefined,
): HTMLElement | undefined {
  if (map && typeof map.getContainer === "function") {
    return map.getContainer();
  }
  return undefined;
}

/**
 * Detects which corner the control container is docked in, by inspecting the
 * MapLibre control-stack wrapper that holds the container.
 *
 * @param container - The control's outer container element.
 * @returns The docking corner; defaults to "top-right" when unknown.
 */
function getControlCorner(
  container: HTMLElement | undefined,
): "top-left" | "top-right" | "bottom-left" | "bottom-right" {
  const parent = container?.parentElement;
  if (!parent) return "top-right";
  if (parent.classList.contains("maplibregl-ctrl-top-left")) return "top-left";
  if (parent.classList.contains("maplibregl-ctrl-top-right"))
    return "top-right";
  if (parent.classList.contains("maplibregl-ctrl-bottom-left"))
    return "bottom-left";
  if (parent.classList.contains("maplibregl-ctrl-bottom-right"))
    return "bottom-right";
  return "top-right";
}

/**
 * Computes the vertical room available to a panel: from the panel's current
 * top edge down to the bottom of the map container (for top-docked controls),
 * or from the panel's bottom edge up to the top of the map container (for
 * bottom-docked controls), less a small margin. Falls back to the viewport
 * height when the map rect is unavailable.
 *
 * @param panel - The panel element.
 * @param map - The MapLibre map instance, used to read the map container rect.
 * @param container - The control container, used to detect the docking corner.
 * @returns The available height in pixels (never below a small floor).
 */
function availableHeight(
  panel: HTMLElement,
  map: MapLibreMap | undefined,
  container: HTMLElement | undefined,
): number {
  const mapContainer = getMapContainer(map);
  const panelRect = panel.getBoundingClientRect();
  const corner = getControlCorner(container);
  const bottom = corner.startsWith("bottom");

  if (mapContainer) {
    const mapRect = mapContainer.getBoundingClientRect();
    const room = bottom
      ? panelRect.bottom - mapRect.top - PANEL_EDGE_MARGIN
      : mapRect.bottom - panelRect.top - PANEL_EDGE_MARGIN;
    return Math.max(160, room);
  }

  // No map container (e.g. in tests): fall back to the viewport.
  const viewport = typeof window !== "undefined" ? window.innerHeight : 720;
  return Math.max(160, viewport - PANEL_EDGE_MARGIN);
}

/**
 * Drives a panel's `maxHeight` so it sizes to content yet may grow up to the
 * vertical space available between its docked corner and the opposite map edge.
 * The content area scrolls (via `overflow-y: auto`) only on overflow. Call this
 * whenever the panel is (re)rendered or the map resizes.
 *
 * @param panel - The panel element to cap.
 * @param map - The MapLibre map instance.
 * @param container - The control container element.
 */
export function applyPanelMaxHeight(
  panel: HTMLElement,
  map: MapLibreMap | undefined,
  container: HTMLElement | undefined,
): void {
  const available = availableHeight(panel, map, container);
  panel.style.maxHeight = `min(80vh, 720px, ${available}px)`;
  panel.style.overflowY = "auto";
}

/**
 * Options controlling how the resize handle and persisted size behave.
 */
export interface PanelResizeOptions {
  /** The panel element to make resizable. */
  panel: HTMLElement;
  /** The MapLibre map instance. */
  map: MapLibreMap | undefined;
  /** The control container element (used to detect the docking corner). */
  container: HTMLElement | undefined;
  /** Reads the persisted user size, if any. */
  getUserSize: () => UserPanelSize | null;
  /** Stores the user size as the handle is dragged. */
  setUserSize: (size: UserPanelSize) => void;
  /** Smallest allowed width. Defaults to {@link PANEL_MIN_WIDTH}. */
  minWidth?: number;
  /** Smallest allowed height. Defaults to {@link PANEL_MIN_HEIGHT}. */
  minHeight?: number;
}

/**
 * Re-applies a persisted user-chosen panel size, clamped to the room available
 * from the panel's docked corner to the opposite map edge. Called after a
 * re-render so the size survives the panel being torn down and rebuilt, and
 * stays within the map after a window or map resize.
 *
 * @param opts - The resize options carrying the panel, map, and size store.
 */
export function applyUserPanelSize(opts: PanelResizeOptions): void {
  const { panel, map, container } = opts;
  const size = opts.getUserSize();
  if (!size) return;
  const minWidth = opts.minWidth ?? PANEL_MIN_WIDTH;
  const minHeight = opts.minHeight ?? PANEL_MIN_HEIGHT;

  const mapContainer = getMapContainer(map);
  const corner = getControlCorner(container);
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const rect = panel.getBoundingClientRect();

  let maxW = Infinity;
  let maxH = Infinity;
  if (mapContainer) {
    const mapRect = mapContainer.getBoundingClientRect();
    maxW =
      (right ? rect.right - mapRect.left : mapRect.right - rect.left) -
      PANEL_EDGE_MARGIN;
    maxH =
      (bottom ? rect.bottom - mapRect.top : mapRect.bottom - rect.top) -
      PANEL_EDGE_MARGIN;
  }

  // Cap to the room available even when that is below the minimum, so a small
  // map cannot force an overflowing panel after a re-render.
  const width = Math.min(Math.max(minWidth, size.width), Math.max(0, maxW));
  const height = Math.min(Math.max(minHeight, size.height), Math.max(0, maxH));

  panel.style.boxSizing = "border-box";
  panel.style.maxWidth = "none";
  panel.style.maxHeight = "none";
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  panel.style.overflowY = "auto";
}

/**
 * Adds two custom pointer-driven resize grips to a floating panel, one in each
 * bottom corner, matching the UX shipped in `maplibre-gl-vector`. The
 * bottom-right grip grows the panel rightward, the bottom-left grip grows it
 * leftward, and both grow it downward. The panel itself stays the scroll
 * container, so its content scrolls within the capped height on overflow.
 *
 * These panels are flowed children of the MapLibre control container (docked
 * top-left under the toggle button), not absolutely positioned in the map
 * container. So, unlike vector's map-relative pinning, the drag temporarily
 * gives the panel `position: fixed` with `left`/`top`/`width`/`height` read from
 * its live `getBoundingClientRect()` (viewport coordinates). This lets the
 * corner-anchored growth math work regardless of the flow parent. On
 * pointerup/cancel the temporary fixed positioning is removed so the panel
 * returns to its docked flow position, but the chosen width/height are kept by
 * persisting them via `setUserSize` (re-applied by {@link applyUserPanelSize} on
 * re-render and map resize).
 *
 * A custom pointer-event handle is used instead of CSS `resize`, which is
 * unreliable in WebKitGTK.
 *
 * @param opts - The resize options carrying the panel, map, and size store.
 * @returns The created handle elements (left, right).
 */
export function addPanelResizeHandles(
  opts: PanelResizeOptions,
): HTMLElement[] {
  const { panel, map, container } = opts;
  const minWidth = opts.minWidth ?? PANEL_MIN_WIDTH;
  const minHeight = opts.minHeight ?? PANEL_MIN_HEIGHT;

  // The handles are absolutely positioned against the panel, so the panel must
  // be a positioned ancestor when docked. The panel itself is the scroll
  // container (it already carries `overflow-y: auto` and the dynamic
  // max-height), so the whole panel scrolls together on overflow.
  if (!panel.style.position || panel.style.position === "static") {
    panel.style.position = "relative";
  }

  const handles: HTMLElement[] = [];

  for (const side of ["left", "right"] as const) {
    const handle = document.createElement("div");
    handle.className = `${PANEL_RESIZE_HANDLE_CLASS} ${
      side === "left" ? PANEL_RESIZE_LEFT_CLASS : PANEL_RESIZE_RIGHT_CLASS
    }`;
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("pointerdown", (event) =>
      beginResize(event, side, handle, opts, minWidth, minHeight),
    );
    panel.appendChild(handle);
    handles.push(handle);
  }

  void map;
  void container;
  return handles;
}

/**
 * Starts a pointer-driven resize from one of the bottom-corner grips.
 *
 * The panel is temporarily switched to `position: fixed` and pinned to its
 * current viewport rect, so the corner-anchored growth math works no matter what
 * the panel's flow parent is. The right grip grows the panel rightward (left
 * edge fixed), the left grip leftward (right edge fixed); both grow it downward.
 * Sizes are clamped to the configured minimums and to the map container rect
 * (less {@link PANEL_EDGE_MARGIN}). On release the fixed positioning is removed
 * so the panel re-docks in flow while its chosen width/height are persisted.
 *
 * @param event - The pointerdown event.
 * @param side - Which bottom corner started the drag.
 * @param handle - The grip element (for pointer capture).
 * @param opts - The resize options carrying the panel, map, and size store.
 * @param minWidth - Smallest allowed width.
 * @param minHeight - Smallest allowed height.
 */
function beginResize(
  event: PointerEvent,
  side: "left" | "right",
  handle: HTMLElement,
  opts: PanelResizeOptions,
  minWidth: number,
  minHeight: number,
): void {
  const { panel, map } = opts;
  event.preventDefault();
  // Keep the drag from bubbling to any document click-outside handler.
  event.stopPropagation();

  const rect = panel.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = rect.width;
  const startHeight = rect.height;
  const startLeft = rect.left;
  const startTop = rect.top;
  const startRight = rect.right;

  const mapContainer = getMapContainer(map);
  const mapRect = mapContainer?.getBoundingClientRect();

  // Save the inline styles we override so flow positioning is restored exactly.
  const saved = {
    position: panel.style.position,
    left: panel.style.left,
    top: panel.style.top,
    right: panel.style.right,
    bottom: panel.style.bottom,
    width: panel.style.width,
    height: panel.style.height,
    maxWidth: panel.style.maxWidth,
    maxHeight: panel.style.maxHeight,
  };

  // Pin the panel to its current viewport rect with fixed positioning, so the
  // corner-anchored resize math is independent of the flow parent. Drop the
  // CSS max-size caps for the duration of the drag.
  panel.style.boxSizing = "border-box";
  panel.style.position = "fixed";
  panel.style.left = `${startLeft}px`;
  panel.style.top = `${startTop}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.width = `${startWidth}px`;
  panel.style.height = `${startHeight}px`;
  panel.style.maxWidth = "none";
  panel.style.maxHeight = "none";

  let userWidth = startWidth;
  let userHeight = startHeight;

  const onMove = (moveEvent: PointerEvent): void => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    let maxHeight = Infinity;
    if (mapRect) {
      maxHeight = Math.max(minHeight, mapRect.bottom - startTop - PANEL_EDGE_MARGIN);
    }
    const nextHeight = Math.max(minHeight, Math.min(startHeight + dy, maxHeight));

    let nextWidth: number;
    let nextLeft = startLeft;
    if (side === "right") {
      let maxWidth = Infinity;
      if (mapRect) {
        maxWidth = Math.max(minWidth, mapRect.right - startLeft - PANEL_EDGE_MARGIN);
      }
      nextWidth = Math.max(minWidth, Math.min(startWidth + dx, maxWidth));
    } else {
      let maxWidth = Infinity;
      if (mapRect) {
        maxWidth = Math.max(minWidth, startRight - mapRect.left - PANEL_EDGE_MARGIN);
      }
      nextWidth = Math.max(minWidth, Math.min(startWidth - dx, maxWidth));
      // Hold the right edge fixed while the left edge follows the drag.
      nextLeft = startLeft + (startWidth - nextWidth);
    }

    panel.style.width = `${nextWidth}px`;
    panel.style.height = `${nextHeight}px`;
    panel.style.left = `${nextLeft}px`;
    userWidth = nextWidth;
    userHeight = nextHeight;
  };

  const cleanup = (endEvent: PointerEvent): void => {
    handle.releasePointerCapture?.(endEvent.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", cleanup);
    handle.removeEventListener("pointercancel", cleanup);

    // Drop the temporary fixed positioning so the panel re-docks in flow.
    panel.style.position = saved.position;
    panel.style.left = saved.left;
    panel.style.top = saved.top;
    panel.style.right = saved.right;
    panel.style.bottom = saved.bottom;

    // Persist the chosen size and re-apply it (clamped) in the flow layout.
    opts.setUserSize({ width: userWidth, height: userHeight });
    panel.style.width = saved.width;
    panel.style.height = saved.height;
    panel.style.maxWidth = saved.maxWidth;
    panel.style.maxHeight = saved.maxHeight;
    applyUserPanelSize(opts);
  };

  handle.setPointerCapture?.(event.pointerId);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", cleanup);
  // Touch/pen drags can end with pointercancel instead of pointerup.
  handle.addEventListener("pointercancel", cleanup);
}
