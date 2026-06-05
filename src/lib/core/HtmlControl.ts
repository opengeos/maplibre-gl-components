import "../styles/common.css";
import "../styles/html-control.css";
import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  HtmlControlItemOptions,
  HtmlControlItemState,
  HtmlControlOptions,
  HtmlControlState,
  ComponentEvent,
  ComponentEventHandler,
} from "./types";

/**
 * Default options for the HtmlControl.
 */
type ResolvedHtmlControlOptions = Required<
  Omit<HtmlControlItemOptions, "element">
> & {
  element?: HTMLElement;
};

const DEFAULT_OPTIONS: ResolvedHtmlControlOptions = {
  html: "",
  element: undefined,
  title: "",
  className: "",
  visible: true,
  collapsible: false,
  collapsed: false,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  maxWidth: 300,
  maxHeight: 400,
  fontSize: 12,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * A flexible HTML content control for MapLibre GL maps.
 *
 * Allows displaying arbitrary HTML content that can be dynamically updated.
 * Supports collapsible mode with a toggle button.
 *
 * @example
 * ```typescript
 * const htmlControl = new HtmlControl({
 *   html: '<div><strong>Stats:</strong> 1,234 features</div>',
 *   position: 'top-left',
 *   collapsible: true,
 *   title: 'Statistics',
 * });
 * map.addControl(htmlControl, 'top-left');
 *
 * // Update content dynamically
 * htmlControl.setHtml('<div><strong>Stats:</strong> 5,678 features</div>');
 * ```
 */
export class HtmlControl implements IControl {
  private _container?: HTMLElement;
  private _contentEl?: HTMLElement;
  private _contentEls: HTMLElement[] = [];
  private _options: ResolvedHtmlControlOptions;
  private _htmlOptions?: HtmlControlItemOptions[];
  private _htmls: ResolvedHtmlControlOptions[];
  private _state: HtmlControlState;
  private _eventHandlers: Map<
    ComponentEvent,
    Set<ComponentEventHandler<HtmlControlState>>
  > = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new HtmlControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: HtmlControlOptions) {
    const { htmls, position: _position, ...entryOptions } = options ?? {};
    void _position;
    this._options = { ...DEFAULT_OPTIONS, ...entryOptions };
    this._htmlOptions = htmls;
    this._htmls = this._resolveHtmls();
    this._state = this._createState();
  }

  /**
   * Called when the control is added to the map.
   * Implements the IControl interface.
   *
   * @param map - The MapLibre GL map instance.
   * @returns The control's container element.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._render();

    // Set up zoom listener
    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);

    // Check initial zoom
    this._checkZoomVisibility();

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   * Implements the IControl interface.
   */
  onRemove(): void {
    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
      this._handleZoom = undefined;
    }
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._contentEl = undefined;
    this._contentEls = [];
    this._eventHandlers.clear();
  }

  /**
   * Shows the control.
   */
  show(): void {
    if (!this._state.visible) {
      this._options.visible = true;
      this._state = this._createState();
      this._updateDisplayState();
      this._emit("show");
    }
  }

  /**
   * Hides the control.
   */
  hide(): void {
    if (this._state.visible) {
      this._options.visible = false;
      this._state = this._createState();
      this._updateDisplayState();
      this._emit("hide");
    }
  }

  /**
   * Expands the control (if collapsible).
   */
  expand(): void {
    if (this._state.collapsed) {
      this._options.collapsed = false;
      this._htmls[0].collapsed = false;
      if (this._htmlOptions?.[0]) {
        this._htmlOptions[0].collapsed = false;
      }
      this._state = this._createState();
      this._render();
      this._emit("expand");
    }
  }

  /**
   * Collapses the control (if collapsible).
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._options.collapsed = true;
      this._htmls[0].collapsed = true;
      if (this._htmlOptions?.[0]) {
        this._htmlOptions[0].collapsed = true;
      }
      this._state = this._createState();
      this._render();
      this._emit("collapse");
    }
  }

  /**
   * Toggles the collapsed state.
   */
  toggle(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Sets the HTML content.
   *
   * @param html - The HTML string to display.
   */
  setHtml(html: string): void {
    this._options.html = html;
    this._options.element = undefined; // Clear element when setting HTML
    this._htmls[0].html = html;
    this._htmls[0].element = undefined;
    if (this._htmlOptions?.[0]) {
      this._htmlOptions[0].html = html;
      this._htmlOptions[0].element = undefined;
    }
    this._state = this._createState();
    if (this._contentEl) {
      this._contentEl.innerHTML = html;
    }
    this._emit("update");
  }

  /**
   * Sets a DOM element as content.
   *
   * @param element - The DOM element to display.
   */
  setElement(element: HTMLElement): void {
    this._options.element = element;
    this._options.html = "";
    this._htmls[0].element = element;
    this._htmls[0].html = "";
    if (this._htmlOptions?.[0]) {
      this._htmlOptions[0].element = element;
      this._htmlOptions[0].html = "";
    }
    this._state = this._createState();
    if (this._contentEl) {
      this._contentEl.innerHTML = "";
      this._contentEl.appendChild(element);
    }
    this._emit("update");
  }

  /**
   * Gets the content container element.
   *
   * @returns The content container element, or undefined if not yet added to map.
   */
  getElement(): HTMLElement | undefined {
    return this._contentEl;
  }

  /**
   * Gets all content container elements.
   *
   * @returns The content container elements, or an empty array before map add.
   */
  getElements(): HTMLElement[] {
    return [...this._contentEls];
  }

  /**
   * Updates control options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<HtmlControlOptions>): void {
    const { htmls, position: _position, ...entryOptions } = options;
    void _position;
    this._options = { ...this._options, ...entryOptions };
    if (htmls !== undefined) {
      this._htmlOptions = htmls;
    }
    this._htmls = this._resolveHtmls();
    this._state = this._createState();
    this._render();
    this._emit("update");
  }

  /**
   * Gets the current state.
   *
   * @returns The current control state.
   */
  getState(): HtmlControlState {
    return {
      ...this._state,
      htmls: this._state.htmls?.map((html) => ({ ...html })),
    };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(
    event: ComponentEvent,
    handler: ComponentEventHandler<HtmlControlState>,
  ): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event handler.
   *
   * @param event - The event type.
   * @param handler - The callback function to remove.
   */
  off(
    event: ComponentEvent,
    handler: ComponentEventHandler<HtmlControlState>,
  ): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Resolves configured HTML entries against the control defaults.
   *
   * @returns Array of resolved HTML control options.
   */
  private _resolveHtmls(): ResolvedHtmlControlOptions[] {
    if (this._htmlOptions && this._htmlOptions.length > 0) {
      return this._htmlOptions.map((html) => ({
        ...this._options,
        ...html,
        element: html.element ?? this._options.element,
      }));
    }

    return [this._options];
  }

  /**
   * Creates public state from the current HTML entries.
   *
   * @returns The current HTML control state.
   */
  private _createState(): HtmlControlState {
    const htmls = this._htmls.map((html, index) =>
      this._createHtmlState(html, index),
    );
    return { ...htmls[0], visible: this._options.visible, htmls };
  }

  /**
   * Creates public state for a single HTML entry.
   *
   * @param html - The resolved HTML options.
   * @param index - The HTML entry index.
   * @returns The current HTML entry state.
   */
  private _createHtmlState(
    html: ResolvedHtmlControlOptions,
    index: number,
  ): HtmlControlItemState {
    return {
      visible: this._getHtmlEntryVisible(index, html.visible),
      collapsed: html.collapsed,
      html: html.html,
    };
  }

  /**
   * Gets an entry's configured visibility.
   *
   * @param index - The entry index.
   * @param fallback - The fallback visibility value.
   * @returns Whether the entry is configured as visible.
   */
  private _getHtmlEntryVisible(index: number, fallback: boolean): boolean {
    if (this._htmlOptions && this._htmlOptions.length > 0) {
      return this._htmlOptions[index]?.visible ?? true;
    }

    return fallback;
  }

  /**
   * Emits an event to all registered handlers.
   *
   * @param event - The event type to emit.
   */
  private _emit(event: ComponentEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState() };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Checks if the current zoom level is within the visibility range.
   */
  private _checkZoomVisibility(): void {
    const inRange = this._hasVisibleHtmls();

    if (inRange !== this._zoomVisible) {
      this._zoomVisible = inRange;
      this._render();
    }
  }

  /**
   * Updates the display state based on visibility and zoom level.
   */
  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._hasVisibleHtmls();
    this._container.style.display = shouldShow ? "flex" : "none";
  }

  /**
   * Checks whether an HTML entry is visible at the current zoom.
   *
   * @param html - The resolved HTML options.
   * @param index - The HTML entry index.
   * @returns Whether the HTML entry should be rendered.
   */
  private _isHtmlVisible(
    html: ResolvedHtmlControlOptions,
    index: number,
  ): boolean {
    if (!this._getHtmlEntryVisible(index, html.visible)) return false;
    if (!this._map) return true;

    const zoom = this._map.getZoom();
    return zoom >= html.minzoom && zoom <= html.maxzoom;
  }

  /**
   * Checks whether any HTML entry should be visible.
   *
   * @returns Whether at least one HTML entry should be visible.
   */
  private _hasVisibleHtmls(): boolean {
    if (!this._state.visible) return false;
    return this._htmls.some((html, index) => this._isHtmlVisible(html, index));
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-html-control${
      this._options.className ? ` ${this._options.className}` : ""
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = "none";
    }

    return container;
  }

  /**
   * Toggles an HTML entry.
   *
   * @param index - The HTML entry index.
   */
  private _toggleHtml(index: number): void {
    const html = this._htmls[index];
    if (!html) return;

    html.collapsed = !html.collapsed;
    if (index === 0) {
      this._options.collapsed = html.collapsed;
      if (this._htmlOptions?.[0]) {
        this._htmlOptions[0].collapsed = html.collapsed;
      }
    }
    this._state = this._createState();
    this._render();
    this._emit(html.collapsed ? "collapse" : "expand");
  }

  /**
   * Creates an HTML entry element.
   *
   * @param html - The resolved HTML options.
   * @param index - The HTML entry index.
   * @returns The HTML entry element.
   */
  private _createHtmlElement(
    html: ResolvedHtmlControlOptions,
    index: number,
  ): HTMLElement {
    const {
      title = "",
      collapsible = false,
      backgroundColor = "rgba(255, 255, 255, 0.9)",
      opacity = 1,
      borderRadius = 4,
      padding = 10,
      maxWidth = 300,
      maxHeight = 400,
      fontSize = 12,
      fontColor = "#333",
      className = "",
    } = html;
    const htmlEl = document.createElement("div");
    htmlEl.className = `maplibre-gl-html-control-entry${
      className ? ` ${className}` : ""
    }`;

    // Apply container styles
    // When collapsed with header, use minimal vertical padding
    const isCollapsedWithHeader = html.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 4 : padding;
    Object.assign(htmlEl.style, {
      backgroundColor,
      opacity: String(opacity),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${padding}px`,
      maxWidth: `${maxWidth}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.1)",
      display: "block",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Add header with toggle if collapsible
    if (collapsible || title) {
      const header = document.createElement("div");
      header.className = "maplibre-gl-html-control-header";
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: html.collapsed ? "0" : "8px",
        cursor: collapsible ? "pointer" : "default",
      });

      if (title) {
        const titleEl = document.createElement("span");
        titleEl.className = "maplibre-gl-html-control-title";
        titleEl.textContent = title;
        titleEl.style.fontWeight = "600";
        header.appendChild(titleEl);
      }

      if (collapsible) {
        const toggleBtn = document.createElement("span");
        toggleBtn.className = "maplibre-gl-html-control-toggle";
        toggleBtn.innerHTML = html.collapsed ? "&#9654;" : "&#9660;";
        Object.assign(toggleBtn.style, {
          marginLeft: "8px",
          fontSize: "10px",
          userSelect: "none",
        });
        header.appendChild(toggleBtn);
        header.addEventListener("click", () => this._toggleHtml(index));
      }

      htmlEl.appendChild(header);
    }

    // Create content element
    const content = document.createElement("div");
    content.className = "maplibre-gl-html-control-content";
    Object.assign(content.style, {
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
      display: html.collapsed ? "none" : "block",
    });
    this._contentEls.push(content);
    if (!this._contentEl) {
      this._contentEl = content;
    }

    // Set content
    if (html.element) {
      content.appendChild(html.element);
    } else if (html.html) {
      content.innerHTML = html.html;
    }

    htmlEl.appendChild(content);

    return htmlEl;
  }

  /**
   * Renders the control content.
   */
  private _render(): void {
    if (!this._container) return;

    this._container.innerHTML = "";
    this._contentEl = undefined;
    this._contentEls = [];

    const shouldShow = this._hasVisibleHtmls();
    Object.assign(this._container.style, {
      display: shouldShow ? "flex" : "none",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "8px",
      background: "transparent",
      boxShadow: "none",
      padding: "0",
    });

    this._htmls.forEach((html, index) => {
      if (this._isHtmlVisible(html, index)) {
        this._container?.appendChild(this._createHtmlElement(html, index));
      }
    });
  }
}
