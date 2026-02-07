import '../styles/common.css';
import '../styles/html-control.css';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  HtmlControlOptions,
  HtmlControlState,
  ComponentEvent,
  ComponentEventHandler,
} from './types';

/**
 * Default options for the HtmlControl.
 */
const DEFAULT_OPTIONS: Required<Omit<HtmlControlOptions, 'element'>> & { element?: HTMLElement } = {
  html: '',
  element: undefined,
  title: '',
  position: 'top-left',
  className: '',
  visible: true,
  collapsible: false,
  collapsed: false,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  maxWidth: 300,
  maxHeight: 400,
  fontSize: 12,
  fontColor: '#333',
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
  private _options: Required<Omit<HtmlControlOptions, 'element'>> & { element?: HTMLElement };
  private _state: HtmlControlState;
  private _eventHandlers: Map<ComponentEvent, Set<ComponentEventHandler<HtmlControlState>>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  /**
   * Creates a new HtmlControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: HtmlControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      html: this._options.html,
    };
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
    this._map.on('zoom', this._handleZoom);

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
      this._map.off('zoom', this._handleZoom);
      this._handleZoom = undefined;
    }
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._contentEl = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Shows the control.
   */
  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit('show');
    }
  }

  /**
   * Hides the control.
   */
  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit('hide');
    }
  }

  /**
   * Expands the control (if collapsible).
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit('expand');
    }
  }

  /**
   * Collapses the control (if collapsible).
   */
  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit('collapse');
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
    this._state.html = html;
    this._options.html = html;
    this._options.element = undefined; // Clear element when setting HTML
    if (this._contentEl) {
      this._contentEl.innerHTML = html;
    }
    this._emit('update');
  }

  /**
   * Sets a DOM element as content.
   *
   * @param element - The DOM element to display.
   */
  setElement(element: HTMLElement): void {
    this._options.element = element;
    this._options.html = '';
    this._state.html = '';
    if (this._contentEl) {
      this._contentEl.innerHTML = '';
      this._contentEl.appendChild(element);
    }
    this._emit('update');
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
   * Updates control options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<HtmlControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.html !== undefined) this._state.html = options.html;
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined) this._state.collapsed = options.collapsed;
    this._render();
    this._emit('update');
  }

  /**
   * Gets the current state.
   *
   * @returns The current control state.
   */
  getState(): HtmlControlState {
    return { ...this._state };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: ComponentEvent, handler: ComponentEventHandler<HtmlControlState>): void {
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
  off(event: ComponentEvent, handler: ComponentEventHandler<HtmlControlState>): void {
    this._eventHandlers.get(event)?.delete(handler);
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
    if (!this._map) return;

    const zoom = this._map.getZoom();
    const { minzoom, maxzoom } = this._options;
    const inRange = zoom >= minzoom && zoom <= maxzoom;

    if (inRange !== this._zoomVisible) {
      this._zoomVisible = inRange;
      this._updateDisplayState();
    }
  }

  /**
   * Updates the display state based on visibility and zoom level.
   */
  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? 'block' : 'none';
  }

  /**
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibre-gl-html-control${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) {
      container.style.display = 'none';
    }

    return container;
  }

  /**
   * Renders the control content.
   */
  private _render(): void {
    if (!this._container) return;

    const {
      title = '',
      collapsible = false,
      backgroundColor = 'rgba(255, 255, 255, 0.9)',
      opacity = 1,
      borderRadius = 4,
      padding = 10,
      maxWidth = 300,
      maxHeight = 400,
      fontSize = 12,
      fontColor = '#333',
    } = this._options;

    // Clear existing content
    this._container.innerHTML = '';

    // Apply container styles
    // When collapsed with header, use minimal vertical padding
    const isCollapsedWithHeader = this._state.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 4 : padding;
    const shouldShow = this._state.visible && this._zoomVisible;
    Object.assign(this._container.style, {
      backgroundColor,
      opacity: String(opacity),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${padding}px`,
      maxWidth: `${maxWidth}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
      display: shouldShow ? 'block' : 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Add header with toggle if collapsible
    if (collapsible || title) {
      const header = document.createElement('div');
      header.className = 'maplibre-gl-html-control-header';
      Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: this._state.collapsed ? '0' : '8px',
        cursor: collapsible ? 'pointer' : 'default',
      });

      if (title) {
        const titleEl = document.createElement('span');
        titleEl.className = 'maplibre-gl-html-control-title';
        titleEl.textContent = title;
        titleEl.style.fontWeight = '600';
        header.appendChild(titleEl);
      }

      if (collapsible) {
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'maplibre-gl-html-control-toggle';
        toggleBtn.innerHTML = this._state.collapsed ? '&#9654;' : '&#9660;';
        Object.assign(toggleBtn.style, {
          marginLeft: '8px',
          fontSize: '10px',
          userSelect: 'none',
        });
        header.appendChild(toggleBtn);
        header.addEventListener('click', () => this.toggle());
      }

      this._container.appendChild(header);
    }

    // Create content element
    const content = document.createElement('div');
    content.className = 'maplibre-gl-html-control-content';
    Object.assign(content.style, {
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto',
      display: this._state.collapsed ? 'none' : 'block',
    });
    this._contentEl = content;

    // Set content
    if (this._options.element) {
      content.appendChild(this._options.element);
    } else if (this._options.html) {
      content.innerHTML = this._options.html;
    }

    this._container.appendChild(content);
  }
}
