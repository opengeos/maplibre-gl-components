import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type {
  LegendOptions,
  LegendState,
  LegendItem,
  ComponentEvent,
  ComponentEventHandler,
} from './types';

/**
 * Default options for the Legend control.
 */
const DEFAULT_OPTIONS: Required<LegendOptions> = {
  title: '',
  items: [],
  position: 'bottom-left',
  className: '',
  visible: true,
  collapsible: false,
  collapsed: false,
  width: 200,
  maxHeight: 300,
  opacity: 1,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  fontSize: 12,
  fontColor: '#333',
  swatchSize: 16,
  borderRadius: 4,
  padding: 10,
};

/**
 * A categorical legend control for MapLibre GL maps.
 *
 * Displays discrete legend items with color swatches and labels.
 *
 * @example
 * ```typescript
 * const legend = new Legend({
 *   title: 'Land Use',
 *   items: [
 *     { label: 'Residential', color: '#ff6b6b' },
 *     { label: 'Commercial', color: '#4ecdc4' },
 *     { label: 'Industrial', color: '#95a5a6' },
 *   ],
 * });
 * map.addControl(legend, 'bottom-left');
 * ```
 */
export class Legend implements IControl {
  private _container?: HTMLElement;
  private _options: Required<LegendOptions>;
  private _state: LegendState;
  private _eventHandlers: Map<ComponentEvent, Set<ComponentEventHandler<LegendState>>> = new Map();

  /**
   * Creates a new Legend instance.
   *
   * @param options - Configuration options for the legend.
   */
  constructor(options?: LegendOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      items: [...this._options.items],
    };
  }

  /**
   * Called when the control is added to the map.
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
   */
  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Shows the legend.
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
   * Hides the legend.
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
   * Expands the legend (if collapsible).
   */
  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit('expand');
    }
  }

  /**
   * Collapses the legend (if collapsible).
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
   * Updates the legend items.
   *
   * @param items - New legend items.
   */
  setItems(items: LegendItem[]): void {
    this._state.items = [...items];
    this._options.items = [...items];
    this._render();
    this._emit('update');
  }

  /**
   * Adds a legend item.
   *
   * @param item - Legend item to add.
   */
  addItem(item: LegendItem): void {
    this._state.items.push(item);
    this._options.items.push(item);
    this._render();
    this._emit('update');
  }

  /**
   * Removes a legend item by label.
   *
   * @param label - Label of the item to remove.
   */
  removeItem(label: string): void {
    this._state.items = this._state.items.filter((item) => item.label !== label);
    this._options.items = [...this._state.items];
    this._render();
    this._emit('update');
  }

  /**
   * Updates legend options and re-renders.
   *
   * @param options - Partial options to update.
   */
  update(options: Partial<LegendOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.items) this._state.items = [...options.items];
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined) this._state.collapsed = options.collapsed;
    this._render();
    this._emit('update');
  }

  /**
   * Gets the current state.
   *
   * @returns The current legend state.
   */
  getState(): LegendState {
    return { ...this._state, items: [...this._state.items] };
  }

  /**
   * Registers an event handler.
   *
   * @param event - The event type to listen for.
   * @param handler - The callback function.
   */
  on(event: ComponentEvent, handler: ComponentEventHandler<LegendState>): void {
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
  off(event: ComponentEvent, handler: ComponentEventHandler<LegendState>): void {
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
    container.className = `maplibregl-ctrl maplibre-gl-legend${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    if (!this._state.visible) {
      container.style.display = 'none';
    }

    return container;
  }

  /**
   * Creates a color swatch element.
   *
   * @param item - Legend item configuration.
   * @returns The swatch element.
   */
  private _createSwatch(item: LegendItem): HTMLElement {
    const { swatchSize = 16 } = this._options;
    const shape = item.shape || 'square';
    const swatch = document.createElement('span');
    swatch.className = `maplibre-gl-legend-swatch maplibre-gl-legend-swatch-${shape}`;

    // Base styles
    const baseStyles: Record<string, string> = {
      flexShrink: '0',
      display: 'inline-block',
    };

    if (shape === 'line') {
      // Line shape: horizontal line with rounded ends
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: '4px',
        backgroundColor: item.color,
        borderRadius: '2px',
        border: 'none',
        alignSelf: 'center',
      });
    } else if (shape === 'circle') {
      // Circle shape
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
        backgroundColor: item.color,
        borderRadius: '50%',
        border: item.strokeColor ? `2px solid ${item.strokeColor}` : '1px solid rgba(0,0,0,0.1)',
      });
    } else {
      // Square shape (default)
      Object.assign(swatch.style, {
        ...baseStyles,
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
        backgroundColor: item.color,
        borderRadius: '2px',
        border: item.strokeColor ? `2px solid ${item.strokeColor}` : '1px solid rgba(0,0,0,0.1)',
      });
    }

    // If icon is provided, use background image
    if (item.icon) {
      Object.assign(swatch.style, {
        backgroundImage: `url(${item.icon})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: 'transparent',
        border: 'none',
        width: `${swatchSize}px`,
        height: `${swatchSize}px`,
      });
    }

    return swatch;
  }

  /**
   * Renders the legend content.
   */
  private _render(): void {
    if (!this._container) return;

    const {
      title,
      backgroundColor,
      opacity,
      fontSize,
      fontColor,
      borderRadius,
      padding,
      width,
      maxHeight,
      collapsible,
    } = this._options;

    // Clear existing content
    this._container.innerHTML = '';

    // Apply container styles
    // When collapsed with header, use minimal vertical padding to match HtmlControl
    const isCollapsedWithHeader = this._state.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 4 : padding;
    Object.assign(this._container.style, {
      backgroundColor,
      opacity: opacity.toString(),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${padding}px`,
      fontSize: `${fontSize}px`,
      color: fontColor,
      width: isCollapsedWithHeader ? 'auto' : `${width}px`,
      maxWidth: `${width}px`,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
      display: this._state.visible ? 'block' : 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    // Add title/header
    if (title || collapsible) {
      const header = document.createElement('div');
      header.className = 'maplibre-gl-legend-header';
      Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: this._state.collapsed ? '0' : '4px',
        cursor: collapsible ? 'pointer' : 'default',
      });

      if (title) {
        const titleEl = document.createElement('span');
        titleEl.className = 'maplibre-gl-legend-title';
        titleEl.textContent = title;
        titleEl.style.fontWeight = '600';
        header.appendChild(titleEl);
      }

      if (collapsible) {
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'maplibre-gl-legend-toggle';
        toggleBtn.innerHTML = this._state.collapsed ? '&#9654;' : '&#9660;';
        toggleBtn.style.marginLeft = '8px';
        header.appendChild(toggleBtn);
        header.addEventListener('click', () => this.toggle());
      }

      this._container.appendChild(header);
    }

    // Content area
    const content = document.createElement('div');
    content.className = 'maplibre-gl-legend-content';
    Object.assign(content.style, {
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto',
      display: this._state.collapsed ? 'none' : 'block',
    });

    // Render legend items
    this._state.items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'maplibre-gl-legend-item';
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
      });

      const swatch = this._createSwatch(item);
      const label = document.createElement('span');
      label.className = 'maplibre-gl-legend-label';
      label.textContent = item.label;

      row.appendChild(swatch);
      row.appendChild(label);
      content.appendChild(row);
    });

    this._container.appendChild(content);
  }
}
