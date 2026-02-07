import '../styles/common.css';
import '../styles/control-grid.css';
import { GlobeControl, type IControl, type Map as MapLibreMap } from 'maplibre-gl';
import type {
  ControlGridOptions,
  ControlGridState,
  ControlGridEvent,
  ControlGridEventHandler,
  DefaultControlName,
} from './types';
import { TerrainControl } from './Terrain';
import { SearchControl } from './SearchControl';
import { ViewStateControl } from './ViewStateControl';
import { InspectControl } from './InspectControl';
import { VectorDatasetControl } from './VectorDataset';
import { BasemapControl } from './Basemap';
import { CogLayerControl } from './CogLayer';

/**
 * Default options for the ControlGrid.
 */
const DEFAULT_OPTIONS: Required<
  Omit<ControlGridOptions, 'controls' | 'defaultControls'>
> & { controls?: IControl[]; defaultControls?: DefaultControlName[] } = {
  title: '',
  position: 'top-right',
  className: '',
  visible: true,
  collapsible: true,
  collapsed: true,
  rows: 1,
  columns: 3,
  showRowColumnControls: true,
  controls: [],
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  padding: 10,
  borderRadius: 4,
  opacity: 1,
  gap: 6,
  minzoom: 0,
  maxzoom: 24,
};

/** Wrench icon SVG for collapsed state – stroke style matching MapLibre globe icon. */
const WRENCH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

interface ChildEntry {
  control: IControl;
  element: HTMLElement | null;
}

/**
 * A collapsible grid container for MapLibre IControl instances.
 *
 * Hosts multiple controls (e.g. SearchControl, TerrainControl) in a grid layout.
 * Users can configure rows/columns and dynamically add or remove controls.
 *
 * @example
 * ```typescript
 * const grid = new ControlGrid({
 *   title: 'Map Tools',
 *   rows: 2,
 *   columns: 2,
 *   collapsible: true,
 * });
 * grid.addControl(new TerrainControl());
 * grid.addControl(new SearchControl());
 * map.addControl(grid, 'top-right');
 * ```
 */
export class ControlGrid implements IControl {
  private _container?: HTMLElement;
  private _gridEl?: HTMLElement;
  private _options: Required<Omit<ControlGridOptions, 'controls' | 'defaultControls'>> & { controls?: IControl[]; defaultControls?: DefaultControlName[] };
  private _state: ControlGridState;
  private _children: ChildEntry[] = [];
  private _eventHandlers: Map<ControlGridEvent, Set<ControlGridEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  constructor(options?: ControlGridOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      rows: this._options.rows,
      columns: this._options.columns,
    };
    // Add explicitly passed controls
    const initial = options?.controls ?? this._options.controls ?? [];
    initial.forEach((c) => this._children.push({ control: c, element: null }));

    // Create and add built-in default controls
    const defaults = options?.defaultControls ?? [];
    for (const name of defaults) {
      const ctrl = ControlGrid._createDefaultControl(name);
      if (ctrl) this._children.push({ control: ctrl, element: null });
    }
    this._autoGrowRows();
  }

  private static _createDefaultControl(name: DefaultControlName): IControl | null {
    switch (name) {
      case 'globe': return new GlobeControl();
      case 'terrain': return new TerrainControl({ hillshade: true });
      case 'search': return new SearchControl({ collapsed: true });
      case 'viewState': return new ViewStateControl({ collapsed: true });
      case 'inspect': return new InspectControl();
      case 'vectorDataset': return new VectorDatasetControl();
      case 'basemap': return new BasemapControl({ collapsed: true });
      case 'cogLayer': return new CogLayerControl({ collapsed: true });
      default: return null;
    }
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on('zoom', this._handleZoom);
    this._checkZoomVisibility();

    this._render();
    this._mountChildren();

    return this._container;
  }

  onRemove(): void {
    if (this._map && this._handleZoom) {
      this._map.off('zoom', this._handleZoom);
      this._handleZoom = undefined;
    }
    this._unmountChildren();
    this._map = undefined;
    this._container?.parentNode?.removeChild(this._container);
    this._container = undefined;
    this._gridEl = undefined;
    this._children = [];
    this._eventHandlers.clear();
  }

  /**
   * Add a control to the grid. If the control is already on the map, it is mounted into the grid.
   */
  addControl(control: IControl): void {
    if (this._children.some((e) => e.control === control)) return;
    const entry: ChildEntry = { control, element: null };
    this._children.push(entry);
    this._autoGrowRows();
    if (this._map && this._gridEl) {
      entry.element = control.onAdd(this._map);
      this._gridEl.appendChild(entry.element);
    }
    this._emit('controladd', control);
  }

  /**
   * Remove a control from the grid. The control's onRemove is called.
   */
  removeControl(control: IControl): void {
    const index = this._children.findIndex((e) => e.control === control);
    if (index === -1) return;
    const entry = this._children[index];
    if (entry.element?.parentNode) {
      entry.element.parentNode.removeChild(entry.element);
    }
    if (this._map) control.onRemove(this._map);
    this._children.splice(index, 1);
    this._emit('controlremove', control);
  }

  /**
   * Set the number of grid rows.
   */
  setRows(rows: number): void {
    const n = Math.max(1, Math.min(12, Math.round(rows)));
    if (this._state.rows === n) return;
    this._state.rows = n;
    this._applyGridStyle();
    this._emit('update');
  }

  /**
   * Set the number of grid columns.
   */
  setColumns(columns: number): void {
    const n = Math.max(1, Math.min(12, Math.round(columns)));
    if (this._state.columns === n) return;
    this._state.columns = n;
    this._applyGridStyle();
    this._emit('update');
  }

  /**
   * Get the list of controls currently in the grid.
   */
  getControls(): IControl[] {
    return this._children.map((e) => e.control);
  }

  show(): void {
    if (!this._state.visible) {
      this._state.visible = true;
      this._updateDisplayState();
      this._emit('show');
    }
  }

  hide(): void {
    if (this._state.visible) {
      this._state.visible = false;
      this._updateDisplayState();
      this._emit('hide');
    }
  }

  expand(): void {
    if (this._state.collapsed) {
      this._state.collapsed = false;
      this._render();
      this._emit('expand');
    }
  }

  collapse(): void {
    if (!this._state.collapsed) {
      this._state.collapsed = true;
      this._render();
      this._emit('collapse');
    }
  }

  toggle(): void {
    if (this._state.collapsed) this.expand();
    else this.collapse();
  }

  getState(): ControlGridState {
    return { ...this._state };
  }

  update(options: Partial<ControlGridOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.visible !== undefined) this._state.visible = options.visible;
    if (options.collapsed !== undefined) this._state.collapsed = options.collapsed;
    if (options.rows !== undefined) this._state.rows = Math.max(1, Math.min(12, options.rows));
    if (options.columns !== undefined)
      this._state.columns = Math.max(1, Math.min(12, options.columns));
    this._render();
    this._emit('update');
  }

  on(event: ControlGridEvent, handler: ControlGridEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: ControlGridEvent, handler: ControlGridEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private _emit(event: ControlGridEvent, control?: IControl): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), control };
      handlers.forEach((h) => h(payload));
    }
  }

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

  private _updateDisplayState(): void {
    if (!this._container) return;
    const shouldShow = this._state.visible && this._zoomVisible;
    this._container.style.display = shouldShow ? 'block' : 'none';
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibre-gl-control-grid${
      this._options.className ? ` ${this._options.className}` : ''
    }`;
    const shouldShow = this._state.visible && this._zoomVisible;
    if (!shouldShow) container.style.display = 'none';
    return container;
  }

  private _autoGrowRows(): void {
    const capacity = this._state.rows * this._state.columns;
    if (this._children.length > capacity) {
      this._state.rows = Math.ceil(this._children.length / this._state.columns);
      this._applyGridStyle();
    }
  }

  private _applyGridStyle(): void {
    if (!this._gridEl) return;
    if (this._state.collapsed) {
      this._gridEl.style.display = 'none';
      return;
    }
    const gap = this._options.gap;
    this._gridEl.style.display = 'grid';
    this._gridEl.style.gridTemplateColumns = `repeat(${this._state.columns}, auto)`;
    this._gridEl.style.gridTemplateRows = `repeat(${this._state.rows}, auto)`;
    this._gridEl.style.gap = `${gap}px`;
    // Center grid tracks and controls to balance left/right padding when the header is wider.
    this._gridEl.style.width = '100%';
    this._gridEl.style.justifyContent = 'center';
    this._gridEl.style.alignContent = 'center';
    this._gridEl.style.justifyItems = 'center';
    this._gridEl.style.alignItems = 'center';
  }

  private _mountChildren(): void {
    if (!this._map || !this._gridEl) return;
    this._children.forEach((entry) => {
      if (entry.element) {
        if (entry.element.parentNode !== this._gridEl) {
          this._gridEl!.appendChild(entry.element);
        }
      } else {
        entry.element = entry.control.onAdd(this._map!);
        this._gridEl!.appendChild(entry.element);
      }
    });
  }

  private _unmountChildren(): void {
    const map = this._map;
    this._children.forEach((entry) => {
      if (entry.element?.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      if (map) entry.control.onRemove(map);
    });
    this._children = this._children.map((e) => ({ control: e.control, element: null }));
  }

  private _render(): void {
    if (!this._container) return;

    const {
      title,
      collapsible,
      backgroundColor,
      opacity,
      borderRadius,
      padding,
      showRowColumnControls,
    } = this._options;

    this._container.innerHTML = '';

    if (this._state.collapsed) {
      this._container.classList.add('maplibre-gl-control-grid--collapsed');
    } else {
      this._container.classList.remove('maplibre-gl-control-grid--collapsed');
    }

    const isCollapsedWithHeader = this._state.collapsed && (title || collapsible);
    const vertPadding = isCollapsedWithHeader ? 0 : padding;
    const leftPadding = isCollapsedWithHeader ? 0 : padding;
    const rightPadding = isCollapsedWithHeader ? 0 : Math.max(0, padding - 4);
    const shouldShow = this._state.visible && this._zoomVisible;

    Object.assign(this._container.style, {
      backgroundColor,
      opacity: String(opacity),
      borderRadius: `${borderRadius}px`,
      padding: `${vertPadding}px ${rightPadding}px ${vertPadding}px ${leftPadding}px`,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
      display: shouldShow ? 'block' : 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#1a1a1a',
    });

    if (collapsible || title) {
      const header = document.createElement('div');
      header.className = 'maplibre-gl-control-grid-header';
      Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: this._state.collapsed ? 'center' : 'space-between',
        flexWrap: 'wrap',
        gap: '6px',
        paddingBottom: this._state.collapsed ? '0' : '0',
        cursor: collapsible ? 'pointer' : 'default',
      });

      if (this._state.collapsed && collapsible) {
        // Collapsed: show only a square wrench icon (no grid, no title)
        const iconWrap = document.createElement('span');
        iconWrap.className = 'maplibre-gl-control-grid-wrench';
        iconWrap.innerHTML = WRENCH_ICON;
        Object.assign(iconWrap.style, {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '29px',
          height: '29px',
          lineHeight: '0',
          boxSizing: 'border-box',
        });
        iconWrap.setAttribute('aria-label', 'Map tools');
        header.appendChild(iconWrap);
        header.addEventListener('click', () => this.toggle());
      } else {
        // Expanded: title, row/column inputs, toggle arrow
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '6px';

        if (title) {
          const titleEl = document.createElement('span');
          titleEl.className = 'maplibre-gl-control-grid-title';
          titleEl.textContent = title;
          titleEl.style.fontWeight = '600';
          titleEl.style.color = '#333';
          left.appendChild(titleEl);
        }

        if (showRowColumnControls && !this._state.collapsed) {
          const rowLabel = document.createElement('label');
          rowLabel.style.display = 'inline-flex';
          rowLabel.style.alignItems = 'center';
          rowLabel.style.gap = '2px';
          rowLabel.style.fontSize = '11px';
          rowLabel.style.color = '#333';
          rowLabel.innerHTML = 'R:';
          const rowInput = document.createElement('input');
          rowInput.type = 'number';
          rowInput.min = '1';
          rowInput.max = '12';
          rowInput.value = String(this._state.rows);
          rowInput.style.width = '40px';
          rowInput.style.padding = '2px 2px';
          rowInput.style.boxSizing = 'border-box';
          rowInput.style.textAlign = 'center';
          rowInput.style.color = '#333';
          rowInput.addEventListener('change', () => this.setRows(Number(rowInput.value) || 1));
          rowLabel.appendChild(rowInput);

          const colLabel = document.createElement('label');
          colLabel.style.display = 'inline-flex';
          colLabel.style.alignItems = 'center';
          colLabel.style.gap = '2px';
          colLabel.style.fontSize = '11px';
          colLabel.style.color = '#333';
          colLabel.innerHTML = 'C:';
          const colInput = document.createElement('input');
          colInput.type = 'number';
          colInput.min = '1';
          colInput.max = '12';
          colInput.value = String(this._state.columns);
          colInput.style.width = '40px';
          colInput.style.padding = '2px 2px';
          colInput.style.boxSizing = 'border-box';
          colInput.style.textAlign = 'center';
          colInput.style.color = '#333';
          colInput.addEventListener('change', () => this.setColumns(Number(colInput.value) || 1));
          colLabel.appendChild(colInput);

          left.appendChild(rowLabel);
          left.appendChild(colLabel);
        }

        header.appendChild(left);

        if (collapsible) {
          const toggleBtn = document.createElement('span');
          toggleBtn.className = 'maplibre-gl-control-grid-toggle';
          toggleBtn.innerHTML = '&#9660;';
          Object.assign(toggleBtn.style, { fontSize: '10px', userSelect: 'none', color: '#333' });
          header.appendChild(toggleBtn);
          header.addEventListener('click', (ev) => {
            if (!showRowColumnControls || !left.contains(ev.target as Node)) this.toggle();
          });
        }
      }

      this._container.appendChild(header);
    }

    const content = document.createElement('div');
    content.className = 'maplibre-gl-control-grid-content';
    Object.assign(content.style, {
      display: this._state.collapsed ? 'none' : 'block',
    });
    this._gridEl = content;
    this._applyGridStyle();
    this._container.appendChild(content);

    this._mountChildren();
  }
}
