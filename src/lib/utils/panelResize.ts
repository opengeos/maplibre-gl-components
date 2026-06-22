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
export const PANEL_BODY_CLASS = "maplibre-gl-panel-body";

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
  // Cap at the room actually available (and a hard 720px ceiling), not 80vh: an
  // 80vh cap is smaller than the available room on common window sizes, so a
  // panel that would otherwise fit was forced to scroll. The panel still sizes
  // to its content and only scrolls when the content exceeds this cap.
  panel.style.maxHeight = `min(720px, ${available}px)`;
  // The panel is a flex column whose inner body scrolls (see addPanelResizeHandles);
  // the panel itself never scrolls, so the resize grips stay pinned to its
  // visible bottom corners and a stray sub-pixel overflow adds no panel scrollbar.
  panel.style.overflowX = "hidden";
  panel.style.overflowY = "hidden";

  // Keep the scrollbar from covering the fields without leaving an idle margin.
  // Only while the body overflows, reserve a consistent gutter on its right:
  // top up the layout width a classic scrollbar already takes (WebKit
  // ::-webkit-scrollbar) to a fixed total, or reserve the whole gutter when the
  // scrollbar is an overlay that takes no width (e.g. Linux Chromium) and would
  // otherwise float over the fields. When the body fits, no padding is added,
  // so there is no idle margin.
  const body = panel.querySelector<HTMLElement>(`.${PANEL_BODY_CLASS}`);
  if (body) {
    const overflowing = body.scrollHeight > body.clientHeight;
    const scrollbarWidth = Math.max(0, body.offsetWidth - body.clientWidth);
    const gutter = 14;
    const pad = overflowing ? Math.max(0, gutter - scrollbarWidth) : 0;
    body.style.paddingRight = pad > 0 ? `${pad}px` : "";
  }
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
  // The panel does not scroll; its inner body does, flexing to the new height.
  panel.style.overflowX = "hidden";
  panel.style.overflowY = "hidden";
}

/**
 * Moves everything below the panel header into a scrolling inner body, turning
 * the panel into a flex column: a fixed header, a body that flexes and scrolls,
 * and (added by the caller) resize grips pinned to the panel's visible bottom
 * corners. Without this the panel itself was the scroll container, so the
 * absolutely positioned grips sat at the bottom of the scrollable content
 * (above a long Layers list, left of the scrollbar) instead of the visible
 * bottom edge. These panels are rebuilt on every state change, so this re-wraps
 * the fresh children on each render. The header is taken to be the panel's
 * first child (these controls always append the header first).
 *
 * @param panel - The panel element to restructure.
 */
function wrapPanelBody(panel: HTMLElement): void {
  const children = Array.from(panel.children) as HTMLElement[];
  if (children.length === 0) return;
  let body = children.find((c) => c.classList.contains(PANEL_BODY_CLASS));
  if (!body) {
    body = document.createElement("div");
    body.className = PANEL_BODY_CLASS;
    const header = children[0];
    for (const child of children.slice(1)) body.appendChild(child);
    panel.insertBefore(body, header.nextSibling);
  }
  body.style.flex = "1 1 auto";
  body.style.minHeight = "0";
  body.style.overflowY = "auto";
  body.style.overflowX = "hidden";
  // No scrollbar-gutter (a stable gutter leaves a margin even when nothing
  // scrolls) and no `scrollbar-width` (setting it makes Chromium ignore the
  // ::-webkit-scrollbar styling and fall back to a zero-width overlay that
  // covers the fields). common.css styles `.maplibre-gl-panel-body` with a thin
  // ::-webkit-scrollbar, which is a classic space-taking scrollbar in the
  // WebKit/Chromium engines we target: no space (no margin) when the body fits,
  // and the content reflows clear of it (no covering) when it scrolls.
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.overflow = "hidden";
}

/**
 * Adds two custom pointer-driven resize grips to a floating panel, one in each
 * bottom corner, matching the UX shipped in `maplibre-gl-vector`. The grips are
 * appended to the panel, which is a flex column with a scrolling inner body
 * (see {@link wrapPanelBody}), so they stay pinned to the panel's visible
 * bottom corners while the body scrolls.
 *
 * These panels are flowed children of the MapLibre control container (docked
 * under the toggle button), which keeps the panel anchored at its docked corner.
 * So the drag never changes `position`/`left`/`top`/`right`/`bottom`; it only
 * changes the panel's `width`/`height` and lets the panel grow toward the map
 * interior from the fixed docked corner. (Pinning with `position: fixed` would
 * break under MapLibre's transformed containers, where `fixed` resolves relative
 * to the transformed ancestor rather than the viewport, making the panel jump.)
 * Both grips resize toward the interior, so the handle side no longer changes
 * the direction; both are kept for discoverability. The chosen width/height are
 * persisted via `setUserSize` (re-applied by {@link applyUserPanelSize} on
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

  // Move everything below the header into a scrolling inner body so the grips,
  // which are appended to the (non-scrolling) panel, stay at the panel's
  // visible bottom corners instead of scrolling away inside the content.
  wrapPanelBody(panel);

  // The handles are absolutely positioned against the panel, so the panel must
  // be a positioned ancestor when docked.
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
 * The panel stays in normal flow as a child of the MapLibre control container,
 * which keeps its docked corner anchored for the whole drag. We never touch
 * `position`/`left`/`top`/`right`/`bottom`; doing so would break under MapLibre's
 * transformed map/control containers (where `position: fixed` resolves relative
 * to the transformed ancestor, not the viewport, so the panel would jump). The
 * docked edges captured on pointerdown stay fixed, and on each move we size the
 * panel so its interior corner follows the pointer: the docked corner stays put
 * and the panel grows toward the map interior. Both bottom grips behave the same
 * way. Sizes are clamped to the configured minimums and to the map container rect
 * (less {@link PANEL_EDGE_MARGIN}). The chosen size is persisted via
 * `setUserSize` so it survives a re-render.
 *
 * @param event - The pointerdown event.
 * @param side - Which bottom corner started the drag (both behave identically).
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
  void side;
  event.preventDefault();
  // Keep the drag from bubbling to any document click-outside handler.
  event.stopPropagation();

  // Capture the panel's docked edges in viewport coordinates. The control
  // container keeps the docked corner anchored, so these edges stay fixed for
  // the whole drag and we only ever change width/height.
  const rect = panel.getBoundingClientRect();
  const dockLeft = rect.left;
  const dockRight = rect.right;
  const dockTop = rect.top;
  const dockBottom = rect.bottom;

  const corner = getControlCorner(opts.container);
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");

  const mapContainer = getMapContainer(map);
  const mapRect = mapContainer?.getBoundingClientRect();

  // Resize only: never touch position/left/top/right/bottom, so the docked
  // corner the control container provides stays put.
  panel.style.boxSizing = "border-box";
  panel.style.maxWidth = "none";
  panel.style.maxHeight = "none";

  let userWidth = rect.width;
  let userHeight = rect.height;

  const onMove = (moveEvent: PointerEvent): void => {
    // The panel's interior corner follows the pointer while the docked edges
    // stay fixed.
    let width = right
      ? dockRight - moveEvent.clientX
      : moveEvent.clientX - dockLeft;
    let height = bottom
      ? dockBottom - moveEvent.clientY
      : moveEvent.clientY - dockTop;

    let maxWidth = Infinity;
    let maxHeight = Infinity;
    if (mapRect) {
      maxWidth =
        (right ? dockRight - mapRect.left : mapRect.right - dockLeft) -
        PANEL_EDGE_MARGIN;
      maxHeight =
        (bottom ? dockBottom - mapRect.top : mapRect.bottom - dockTop) -
        PANEL_EDGE_MARGIN;
    }

    width = Math.max(minWidth, Math.min(width, Math.max(minWidth, maxWidth)));
    height = Math.max(
      minHeight,
      Math.min(height, Math.max(minHeight, maxHeight)),
    );

    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    userWidth = width;
    userHeight = height;
  };

  const cleanup = (endEvent: PointerEvent): void => {
    handle.releasePointerCapture?.(endEvent.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", cleanup);
    handle.removeEventListener("pointercancel", cleanup);

    // Persist the chosen size and re-apply it (clamped) so it survives a
    // re-render. applyUserPanelSize does not change position either.
    opts.setUserSize({ width: userWidth, height: userHeight });
    applyUserPanelSize(opts);
  };

  handle.setPointerCapture?.(event.pointerId);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", cleanup);
  // Touch/pen drags can end with pointercancel instead of pointerup.
  handle.addEventListener("pointercancel", cleanup);
}
