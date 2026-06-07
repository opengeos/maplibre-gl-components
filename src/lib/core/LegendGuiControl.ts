import "../styles/common.css";
import "../styles/legend-gui-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  LegendGuiControlOptions,
  LegendGuiControlState,
  LegendGuiEntryState,
  LegendGuiEvent,
  LegendGuiEventHandler,
} from "./types";
import { Legend } from "./Legend";

/**
 * Default options for the LegendGuiControl.
 */
const DEFAULT_OPTIONS: Required<LegendGuiControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  panelWidth: 280,
  maxHeight: 500,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: 4,
  opacity: 1,
  fontSize: 12,
  fontColor: "#333",
  minzoom: 0,
  maxzoom: 24,
};

/** SVG icon for the legend button – grayscale, same-width lines. */
const LEGEND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5" rx="1" fill="#555" stroke="#555"/><line x1="12" y1="5.5" x2="21" y2="5.5"/><rect x="3" y="10" width="5" height="5" rx="1" fill="#999" stroke="#999"/><line x1="12" y1="12.5" x2="21" y2="12.5"/><rect x="3" y="17" width="5" height="5" rx="1" fill="#ccc" stroke="#ccc"/><line x1="12" y1="19.5" x2="21" y2="19.5"/></svg>`;

/** Close icon. */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/** Plus icon. */
const PLUS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

/** Trash icon. */
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

/**
 * A GUI control for adding and configuring legends on the map.
 *
 * Provides a panel to set a title, add/remove items with color and label,
 * and choose the legend position.
 *
 * @example
 * ```typescript
 * const legendGui = new LegendGuiControl({ collapsed: true });
 * map.addControl(legendGui, 'top-right');
 *
 * legendGui.on('legendadd', (e) => {
 *   console.log('Legend added:', e.state);
 * });
 * ```
 */
export class LegendGuiControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<LegendGuiControlOptions>;
  private _state: LegendGuiControlState;
  private _eventHandlers: Map<LegendGuiEvent, Set<LegendGuiEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // Active legend instances
  private _legend?: Legend;
  private _legends: Legend[] = [];
  private _legendEntries: LegendGuiEntryState[] = [];

  // DOM refs
  private _legendSelect?: HTMLSelectElement;
  private _titleInput?: HTMLInputElement;
  private _positionSelect?: HTMLSelectElement;
  private _itemsContainer?: HTMLElement;
  private _dictTextarea?: HTMLTextAreaElement;
  private _dictErrorEl?: HTMLElement;
  private _addBtn?: HTMLButtonElement;
  private _updateBtn?: HTMLButtonElement;
  private _removeBtn?: HTMLButtonElement;

  constructor(options?: LegendGuiControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      title: "Legend",
      items: [
        { label: "Category A", color: "#ff6b6b", shape: "square" },
        { label: "Category B", color: "#4ecdc4", shape: "square" },
        { label: "Category C", color: "#95a5a6", shape: "square" },
      ],
      legendPosition: "bottom-left",
      hasLegend: false,
      selectedLegendIndex: -1,
      legends: [],
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._setupZoomHandler();
    if (!this._state.collapsed) {
      this._showPanel();
    }
    return this._container;
  }

  onRemove(): void {
    if (this._handleZoom && this._map) {
      this._map.off("zoom", this._handleZoom);
    }
    this._removeAllLegends();
    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  on(event: LegendGuiEvent, handler: LegendGuiEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  off(event: LegendGuiEvent, handler: LegendGuiEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(event: LegendGuiEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = {
        type: event,
        state: { ...this._state, items: [...this._state.items] },
      };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  expand(): void {
    if (!this._state.collapsed) return;
    this._state.collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  collapse(): void {
    if (this._state.collapsed) return;
    this._state.collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  show(): this {
    this._state.visible = true;
    if (this._container && this._zoomVisible) {
      this._container.style.display = "";
    }
    this._emit("show");
    return this;
  }

  hide(): this {
    this._state.visible = false;
    if (this._container) {
      this._container.style.display = "none";
    }
    this._emit("hide");
    return this;
  }

  getState(): LegendGuiControlState {
    return {
      ...this._state,
      items: [...this._state.items],
      legends: this._legendEntries.map((entry) => ({
        ...entry,
        items: [...entry.items],
      })),
    };
  }

  setState(state: Partial<LegendGuiControlState>): this {
    if (this._map) {
      this._legends.forEach((legend) => {
        this._map!.removeControl(legend);
      });
    }

    const entries = (state.legends ?? []).map((entry) => ({
      ...entry,
      items: entry.items.map((item) => ({ ...item })),
    }));
    this._legends = [];
    this._legendEntries = entries;

    if (this._map) {
      entries.forEach((entry) => {
        const legend = this._createLegend(entry);
        this._map!.addControl(legend, entry.legendPosition);
        this._legends.push(legend);
      });
    }

    const selectedIndex =
      typeof state.selectedLegendIndex === "number" &&
      state.selectedLegendIndex >= 0 &&
      state.selectedLegendIndex < entries.length
        ? state.selectedLegendIndex
        : entries.length > 0
          ? entries.length - 1
          : -1;
    const formEntry =
      selectedIndex >= 0
        ? entries[selectedIndex]
        : {
            title: state.title ?? this._state.title,
            items: (state.items ?? this._state.items).map((item) => ({
              ...item,
            })),
            legendPosition: state.legendPosition ?? this._state.legendPosition,
          };

    this._state = {
      ...this._state,
      ...formEntry,
      items: formEntry.items.map((item) => ({ ...item })),
      visible: state.visible ?? this._state.visible,
      collapsed: state.collapsed ?? this._state.collapsed,
      hasLegend: entries.length > 0,
      selectedLegendIndex: selectedIndex,
      legends: entries.map((entry) => ({
        ...entry,
        items: entry.items.map((item) => ({ ...item })),
      })),
    };
    this._legend =
      selectedIndex >= 0 ? this._legends[selectedIndex] : undefined;

    this._applyEntryToForm(formEntry);
    if (this._state.collapsed) this._hidePanel();
    else this._showPanel();
    if (this._container) {
      this._container.style.display =
        this._state.visible && this._zoomVisible ? "" : "none";
    }
    this._updateButtonStates();
    this._emit("legendupdate");
    return this;
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-legend-gui-control ${this._options.className}`;
    if (!this._state.visible) {
      container.style.display = "none";
    }

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "legend-gui-button";
    this._button.title = "Legend";
    this._button.innerHTML = LEGEND_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `legend-gui-panel ${this._options.position.includes("left") ? "right" : "left"}`;
    panel.style.minWidth = `${this._options.panelWidth}px`;
    panel.style.width = "auto";
    panel.style.maxWidth = "400px";
    if (this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }
    panel.style.background = this._options.backgroundColor;
    panel.style.borderRadius = `${this._options.borderRadius}px`;
    panel.style.fontSize = `${this._options.fontSize}px`;
    panel.style.color = this._options.fontColor;

    // Header
    const header = document.createElement("div");
    header.className = "legend-gui-header";
    header.innerHTML = `
      <span>Legend</span>
      <button type="button" class="legend-gui-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".legend-gui-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "legend-gui-content";

    const selectorField = this._createField("Legend");
    this._legendSelect = document.createElement("select");
    this._legendSelect.className = "legend-gui-select";
    this._legendSelect.addEventListener("change", () => {
      this._selectLegend(parseInt(this._legendSelect!.value, 10));
    });
    selectorField.appendChild(this._legendSelect);
    content.appendChild(selectorField);
    this._renderLegendSelect();

    // Title
    const titleField = this._createField("Title");
    this._titleInput = document.createElement("input");
    this._titleInput.type = "text";
    this._titleInput.className = "legend-gui-input";
    this._titleInput.placeholder = "Legend title";
    this._titleInput.value = this._state.title;
    this._titleInput.addEventListener("input", () => {
      this._state.title = this._titleInput!.value;
    });
    titleField.appendChild(this._titleInput);
    content.appendChild(titleField);

    // Position
    const posField = this._createField("Position");
    this._positionSelect = document.createElement("select");
    this._positionSelect.className = "legend-gui-select";
    const positions = [
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ];
    positions.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      opt.selected = p.value === this._state.legendPosition;
      this._positionSelect!.appendChild(opt);
    });
    this._positionSelect.addEventListener("change", () => {
      this._state.legendPosition = this._positionSelect!
        .value as ControlPosition;
    });
    posField.appendChild(this._positionSelect);
    content.appendChild(posField);

    // Items section
    const itemsLabel = document.createElement("div");
    itemsLabel.className = "legend-gui-field";
    const itemsHeader = document.createElement("div");
    itemsHeader.className = "legend-gui-items-header";
    const itemsLbl = document.createElement("label");
    itemsLbl.textContent = "Items";
    const addItemBtn = document.createElement("button");
    addItemBtn.type = "button";
    addItemBtn.className = "legend-gui-add-item-btn";
    addItemBtn.innerHTML = PLUS_ICON;
    addItemBtn.title = "Add item";
    addItemBtn.addEventListener("click", () => this._addItem());
    itemsHeader.appendChild(itemsLbl);
    itemsHeader.appendChild(addItemBtn);
    itemsLabel.appendChild(itemsHeader);
    content.appendChild(itemsLabel);

    this._itemsContainer = document.createElement("div");
    this._itemsContainer.className = "legend-gui-items";
    this._renderItems();
    content.appendChild(this._itemsContainer);

    // Import from Dictionary section
    const dictField = this._createField("Import from Dictionary");
    this._dictTextarea = document.createElement("textarea");
    this._dictTextarea.className = "legend-gui-textarea";
    this._dictTextarea.rows = 4;
    this._dictTextarea.placeholder =
      '{"Label A": "#ff6b6b", "Label B": "#4ecdc4"}';
    dictField.appendChild(this._dictTextarea);

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "legend-gui-import-btn";
    importBtn.textContent = "Import Items from Dictionary";
    importBtn.addEventListener("click", () => this._importFromDict());
    dictField.appendChild(importBtn);

    this._dictErrorEl = document.createElement("div");
    this._dictErrorEl.className = "legend-gui-import-error";
    this._dictErrorEl.style.display = "none";
    dictField.appendChild(this._dictErrorEl);
    content.appendChild(dictField);

    // Add/Update button
    this._addBtn = document.createElement("button");
    this._addBtn.type = "button";
    this._addBtn.className = "legend-gui-add-btn";
    this._addBtn.textContent = "Add Legend";
    this._addBtn.addEventListener("click", () => this._addLegend());
    content.appendChild(this._addBtn);

    this._updateBtn = document.createElement("button");
    this._updateBtn.type = "button";
    this._updateBtn.className = "legend-gui-add-btn";
    this._updateBtn.textContent = "Update Selected Legend";
    this._updateBtn.style.display = this._state.hasLegend ? "" : "none";
    this._updateBtn.addEventListener("click", () => this._updateLegend());
    content.appendChild(this._updateBtn);

    // Remove button
    this._removeBtn = document.createElement("button");
    this._removeBtn.type = "button";
    this._removeBtn.className = "legend-gui-remove-btn";
    this._removeBtn.textContent = "Remove Legend";
    this._removeBtn.style.display = this._state.hasLegend ? "" : "none";
    this._removeBtn.addEventListener("click", () => this._removeLegend());
    content.appendChild(this._removeBtn);

    panel.appendChild(content);
    return panel;
  }

  private _createField(label: string): HTMLElement {
    const field = document.createElement("div");
    field.className = "legend-gui-field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    field.appendChild(lbl);
    return field;
  }

  private _renderItems(): void {
    if (!this._itemsContainer) return;
    this._itemsContainer.innerHTML = "";

    this._state.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "legend-gui-item-row";

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "legend-gui-color-input";
      colorInput.value = item.color;
      colorInput.addEventListener("input", () => {
        this._state.items[index].color = colorInput.value;
      });

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "legend-gui-input legend-gui-item-label";
      labelInput.value = item.label;
      labelInput.placeholder = "Label";
      labelInput.addEventListener("input", () => {
        this._state.items[index].label = labelInput.value;
      });

      const shapeSelect = document.createElement("select");
      shapeSelect.className = "legend-gui-select legend-gui-item-shape";
      (["square", "circle", "line"] as const).forEach((shape) => {
        const opt = document.createElement("option");
        opt.value = shape;
        opt.textContent = shape;
        opt.selected = shape === (item.shape || "square");
        shapeSelect.appendChild(opt);
      });
      shapeSelect.addEventListener("change", () => {
        this._state.items[index].shape = shapeSelect.value as
          | "square"
          | "circle"
          | "line";
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "legend-gui-delete-item-btn";
      deleteBtn.innerHTML = TRASH_ICON;
      deleteBtn.title = "Remove item";
      deleteBtn.addEventListener("click", () => {
        this._state.items.splice(index, 1);
        this._renderItems();
      });

      row.appendChild(colorInput);
      row.appendChild(labelInput);
      row.appendChild(shapeSelect);
      row.appendChild(deleteBtn);
      this._itemsContainer!.appendChild(row);
    });
  }

  private _addItem(): void {
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#95a5a6",
      "#f39c12",
      "#9b59b6",
      "#3498db",
      "#2ecc71",
      "#e74c3c",
    ];
    const color = colors[this._state.items.length % colors.length];
    this._state.items.push({
      label: `Item ${this._state.items.length + 1}`,
      color,
      shape: "square",
    });
    this._renderItems();
  }

  private _importFromDict(): void {
    if (!this._dictTextarea || !this._dictErrorEl) return;
    const text = this._dictTextarea.value.trim();
    if (!text) {
      this._dictErrorEl.textContent = "Please paste a JSON dictionary.";
      this._dictErrorEl.style.display = "";
      return;
    }
    try {
      const dict = JSON.parse(text);
      if (typeof dict !== "object" || dict === null || Array.isArray(dict)) {
        throw new Error('Expected a JSON object like {"label": "color"}');
      }
      const entries = Object.entries(dict);
      if (entries.length === 0) {
        throw new Error("Dictionary is empty.");
      }
      const newItems: {
        label: string;
        color: string;
        shape: "square" | "circle" | "line";
      }[] = [];
      for (const [label, color] of entries) {
        if (typeof color !== "string") {
          throw new Error(`Value for "${label}" must be a color string.`);
        }
        newItems.push({ label, color, shape: "square" });
      }
      this._state.items = newItems;
      this._renderItems();
      this._dictErrorEl.style.display = "none";
      this._dictTextarea.value = "";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      this._dictErrorEl.textContent = msg;
      this._dictErrorEl.style.display = "";
    }
  }

  private _getFormEntry(): LegendGuiEntryState {
    return {
      title: this._state.title,
      items: this._state.items.map((item) => ({ ...item })),
      legendPosition: this._state.legendPosition,
    };
  }

  private _applyEntryToForm(entry: LegendGuiEntryState): void {
    this._state.title = entry.title;
    this._state.items = entry.items.map((item) => ({ ...item }));
    this._state.legendPosition = entry.legendPosition;
    if (this._titleInput) this._titleInput.value = entry.title;
    if (this._positionSelect) this._positionSelect.value = entry.legendPosition;
    this._renderItems();
  }

  private _createLegend(entry: LegendGuiEntryState): Legend {
    return new Legend({
      title: entry.title,
      items: entry.items.map((item) => ({ ...item })),
      collapsible: true,
      collapsed: false,
    });
  }

  private _selectLegend(index: number): void {
    if (index < 0) {
      this._state.selectedLegendIndex = -1;
      this._legend = undefined;
      this._updateButtonStates();
      return;
    }
    if (index >= this._legendEntries.length) return;
    this._state.selectedLegendIndex = index;
    this._legend = this._legends[index];
    this._applyEntryToForm(this._legendEntries[index]);
    this._updateButtonStates();
  }

  private _renderLegendSelect(): void {
    if (!this._legendSelect) return;
    this._legendSelect.innerHTML = "";

    const newOpt = document.createElement("option");
    newOpt.value = "-1";
    newOpt.textContent = "New legend";
    this._legendSelect.appendChild(newOpt);

    this._legendEntries.forEach((entry, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = entry.title || `Legend ${index + 1}`;
      this._legendSelect!.appendChild(opt);
    });
    this._legendSelect.value =
      this._state.selectedLegendIndex >= 0
        ? String(this._state.selectedLegendIndex)
        : "-1";
  }

  private _addLegend(): void {
    if (!this._map) return;
    const entry = this._getFormEntry();
    const legend = this._createLegend(entry);
    this._map.addControl(legend, entry.legendPosition);
    this._legends.push(legend);
    this._legendEntries.push(entry);
    this._legend = legend;
    this._state.hasLegend = true;
    this._state.selectedLegendIndex = this._legends.length - 1;
    this._state.legends = this._legendEntries.map((item) => ({
      ...item,
      items: [...item.items],
    }));
    this._updateButtonStates();
    this._emit("legendadd");
  }

  private _updateLegend(): void {
    if (!this._map) return;
    const index = this._state.selectedLegendIndex;
    if (index < 0 || index >= this._legends.length) {
      this._addLegend();
      return;
    }

    const entry = this._getFormEntry();
    this._map.removeControl(this._legends[index]);
    const legend = this._createLegend(entry);
    this._map.addControl(legend, entry.legendPosition);
    this._legends[index] = legend;
    this._legendEntries[index] = entry;
    this._legend = legend;
    this._state.legends = this._legendEntries.map((item) => ({
      ...item,
      items: [...item.items],
    }));
    this._emit("legendupdate");
    this._updateButtonStates();
  }

  private _removeLegend(): void {
    if (!this._map) return;
    const index = this._state.selectedLegendIndex;
    if (index < 0 || index >= this._legends.length) return;

    this._map.removeControl(this._legends[index]);
    this._legends.splice(index, 1);
    this._legendEntries.splice(index, 1);
    this._state.hasLegend = this._legends.length > 0;
    this._state.selectedLegendIndex = this._state.hasLegend
      ? Math.min(index, this._legends.length - 1)
      : -1;
    this._legend =
      this._state.selectedLegendIndex >= 0
        ? this._legends[this._state.selectedLegendIndex]
        : undefined;
    this._state.legends = this._legendEntries.map((item) => ({
      ...item,
      items: [...item.items],
    }));
    if (this._state.selectedLegendIndex >= 0) {
      this._applyEntryToForm(
        this._legendEntries[this._state.selectedLegendIndex],
      );
    }
    this._updateButtonStates();
    this._emit("legendremove");
  }

  private _updateButtonStates(): void {
    if (this._addBtn) {
      this._addBtn.textContent = "Add Legend";
    }
    const hasSelection = this._state.selectedLegendIndex >= 0;
    if (this._updateBtn) {
      this._updateBtn.style.display = hasSelection ? "" : "none";
    }
    if (this._removeBtn) {
      this._removeBtn.style.display = hasSelection ? "" : "none";
    }
    this._renderLegendSelect();
  }

  private _removeAllLegends(): void {
    if (!this._map) return;
    this._legends.forEach((legend) => {
      this._map!.removeControl(legend);
    });
    this._legends = [];
    this._legendEntries = [];
    this._legend = undefined;
    this._state.hasLegend = false;
    this._state.selectedLegendIndex = -1;
    this._state.legends = [];
    this._updateButtonStates();
  }

  private _togglePanel(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  private _showPanel(): void {
    if (!this._panel && this._container) {
      this._panel = this._createPanel();
      this._container.appendChild(this._panel);
    }
    this._button?.classList.add("active");
  }

  private _hidePanel(): void {
    this._panel?.remove();
    this._panel = undefined;
    this._button?.classList.remove("active");
  }

  private _setupZoomHandler(): void {
    if (!this._map) return;
    this._handleZoom = () => {
      const zoom = this._map!.getZoom();
      const shouldShow =
        zoom >= this._options.minzoom && zoom <= this._options.maxzoom;
      if (shouldShow !== this._zoomVisible) {
        this._zoomVisible = shouldShow;
        if (this._container) {
          this._container.style.display =
            shouldShow && this._state.visible ? "" : "none";
        }
      }
    };
    this._map.on("zoom", this._handleZoom);
    this._handleZoom();
  }

  /**
   * Get the active Legend instance (if any).
   */
  getLegend(): Legend | undefined {
    return this._legend;
  }
}
