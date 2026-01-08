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
  position: 'top-left',
  className: '',
  visible: true,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  maxWidth: 300,
  maxHeight: 400,
};

/**
 * A flexible HTML content control for MapLibre GL maps.
 *
 * Allows displaying arbitrary HTML content that can be dynamically updated.
 *
 * @example
 * ```typescript
 * const htmlControl = new HtmlControl({
 *   html: '<div><strong>Stats:</strong> 1,234 features</div>',
 *   position: 'top-left',
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

  /**
   * Creates a new HtmlControl instance.
   *
   * @param options - Configuration options for the control.
   */
  constructor(options?: HtmlControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
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
  onAdd(_map: MapLibreMap): HTMLElement {
    this._container = this._createContainer();
    this._render();
    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   * Implements the IControl interface.
   */
  onRemove(): void {
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
      if (this._container) {
        this._container.style.display = 'block';
      }
      this._emit('show');
    }
  }

  /**
   * Hides the control.
   */
  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      if (this._container) {
        this._container.style.display = 'none';
      }
      this._emit('hide');
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
   * Creates the main container element.
   *
   * @returns The container element.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibre-gl-html-control${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    if (!this._state.visible) {
      container.style.display = 'none';
    }

    return container;
  }

  /**
   * Renders the control content.
   */
  private _render(): void {
    if (!this._container) return;

    const { backgroundColor, opacity, borderRadius, padding, maxWidth, maxHeight } = this._options;

    // Clear existing content
    this._container.innerHTML = '';

    // Apply container styles
    Object.assign(this._container.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      padding: `${padding}px`,
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto',
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
      display: this._state.visible ? 'block' : 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Create content element
    const content = document.createElement('div');
    content.className = 'maplibre-gl-html-control-content';
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
