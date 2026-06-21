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
 * The shared CSS class for the custom corner resize handle. A single class is
 * reused by every floating panel because they share the same styling.
 */
export const PANEL_RESIZE_HANDLE_CLASS = "maplibre-gl-panel-resize";

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
 * Adds a custom pointer-driven resize handle to a floating panel. The panel
 * itself stays the scroll container, so its content scrolls within the capped
 * height on overflow.
 *
 * The handle sits at the panel's inward corner (the corner pointing toward the
 * map interior, derived from the control's docking corner) and resizes both
 * width and height. It can grow and shrink between a minimum and the room
 * available to the opposite map edge, while the docked edges stay fixed. A
 * custom pointer-event handle is used instead of CSS `resize`, which is
 * unreliable in WebKitGTK. The chosen size is persisted via `setUserSize` so it
 * survives the panel being re-rendered, the window resizing, or the map
 * resizing.
 *
 * @param opts - The resize options carrying the panel, map, and size store.
 * @returns The created handle element.
 */
export function addPanelResizeHandle(opts: PanelResizeOptions): HTMLElement {
  const { panel, map, container } = opts;
  const minWidth = opts.minWidth ?? PANEL_MIN_WIDTH;
  const minHeight = opts.minHeight ?? PANEL_MIN_HEIGHT;

  // The handle is absolutely positioned against the panel, so the panel must be
  // a positioned ancestor. The panel itself is the scroll container (it already
  // carries `overflow-y: auto` and the dynamic max-height), so the whole panel
  // scrolls together on overflow.
  if (!panel.style.position || panel.style.position === "static") {
    panel.style.position = "relative";
  }

  const handle = document.createElement("div");
  handle.className = PANEL_RESIZE_HANDLE_CLASS;
  handle.setAttribute("aria-hidden", "true");
  panel.appendChild(handle);

  const placeHandle = (): void => {
    const corner = getControlCorner(container);
    const right = corner.endsWith("right");
    const bottom = corner.startsWith("bottom");
    handle.style.top = bottom ? "0" : "auto";
    handle.style.bottom = bottom ? "auto" : "0";
    handle.style.left = right ? "0" : "auto";
    handle.style.right = right ? "auto" : "0";
    handle.style.cursor = right === bottom ? "nwse-resize" : "nesw-resize";
  };
  placeHandle();

  let right = false;
  let bottom = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let maxW = Infinity;
  let maxH = Infinity;

  const onMove = (event: PointerEvent): void => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const width = Math.min(
      maxW,
      Math.max(minWidth, right ? startW - dx : startW + dx),
    );
    const height = Math.min(
      maxH,
      Math.max(minHeight, bottom ? startH - dy : startH + dy),
    );
    opts.setUserSize({ width, height });
    applyUserPanelSize(opts);
  };
  const onEnd = (event: PointerEvent): void => {
    handle.releasePointerCapture?.(event.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onEnd);
    handle.removeEventListener("pointercancel", onEnd);
  };
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    placeHandle();
    const corner = getControlCorner(container);
    right = corner.endsWith("right");
    bottom = corner.startsWith("bottom");
    const rect = panel.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startW = rect.width;
    startH = rect.height;
    const mapContainer = getMapContainer(map);
    if (mapContainer) {
      const mapRect = mapContainer.getBoundingClientRect();
      // The docked edge is fixed, so the room to grow is constant for the whole
      // drag: from that edge to the opposite map edge, less a margin.
      maxW =
        (right ? rect.right - mapRect.left : mapRect.right - rect.left) -
        PANEL_EDGE_MARGIN;
      maxH =
        (bottom ? rect.bottom - mapRect.top : mapRect.bottom - rect.top) -
        PANEL_EDGE_MARGIN;
    } else {
      maxW = Infinity;
      maxH = Infinity;
    }
    handle.setPointerCapture?.(event.pointerId);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    // Touch/pen drags can end with pointercancel instead of pointerup.
    handle.addEventListener("pointercancel", onEnd);
  });

  return handle;
}
