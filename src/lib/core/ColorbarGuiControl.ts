import "../styles/common.css";
import "../styles/colorbar-gui-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  ColorbarGuiControlOptions,
  ColorbarGuiControlState,
  ColorbarGuiEntryState,
  ColorbarGuiEvent,
  ColorbarGuiEventHandler,
  ColormapName,
  ColorbarOrientation,
} from "./types";
import { Colorbar } from "./Colorbar";
import { getColormap, getColormapNames } from "../colormaps";

/**
 * Default options for the ColorbarGuiControl.
 */
const DEFAULT_OPTIONS: Required<ColorbarGuiControlOptions> = {
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

/** SVG icon for the colorbar button – gradient bar only, no lines. */
const COLORBAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="none"><defs><linearGradient id="cbg" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#440154"/><stop offset="25%" stop-color="#31688e"/><stop offset="50%" stop-color="#21918c"/><stop offset="75%" stop-color="#90d743"/><stop offset="100%" stop-color="#fde725"/></linearGradient></defs><rect x="8" y="2" width="8" height="20" rx="2" fill="url(#cbg)" stroke="currentColor" stroke-width="1.5"/></svg>`;

/** Close icon. */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * A GUI control for adding and configuring colorbars on the map.
 *
 * Provides a panel with colormap selection, value range, label, units,
 * orientation, and position settings. The colorbar is added as a
 * separate control to the map.
 *
 * @example
 * ```typescript
 * const colorbarGui = new ColorbarGuiControl({ collapsed: true });
 * map.addControl(colorbarGui, 'top-right');
 *
 * colorbarGui.on('colorbaradd', (e) => {
 *   console.log('Colorbar added:', e.state);
 * });
 * ```
 */
export class ColorbarGuiControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<ColorbarGuiControlOptions>;
  private _state: ColorbarGuiControlState;
  private _eventHandlers: Map<ColorbarGuiEvent, Set<ColorbarGuiEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // Active colorbar instances
  private _colorbar?: Colorbar;
  private _colorbars: Colorbar[] = [];
  private _colorbarEntries: ColorbarGuiEntryState[] = [];

  // DOM refs
  private _colorbarSelect?: HTMLSelectElement;
  private _colormapSelect?: HTMLSelectElement;
  private _vminInput?: HTMLInputElement;
  private _vmaxInput?: HTMLInputElement;
  private _labelInput?: HTMLInputElement;
  private _unitsInput?: HTMLInputElement;
  private _orientationSelect?: HTMLSelectElement;
  private _positionSelect?: HTMLSelectElement;
  private _addBtn?: HTMLButtonElement;
  private _updateBtn?: HTMLButtonElement;
  private _removeBtn?: HTMLButtonElement;
  private _previewEl?: HTMLElement;

  // DOM refs for custom mode
  private _customColorsTextarea?: HTMLTextAreaElement;
  private _modeNamedRadio?: HTMLInputElement;
  private _modeCustomRadio?: HTMLInputElement;
  private _namedSection?: HTMLElement;
  private _customSection?: HTMLElement;

  constructor(options?: ColorbarGuiControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      mode: "named",
      colormap: "viridis",
      customColors: "#440154, #31688e, #21918c, #90d743, #fde725",
      vmin: 0,
      vmax: 100,
      label: "",
      units: "",
      orientation: "vertical",
      colorbarPosition: "bottom-right",
      hasColorbar: false,
      selectedColorbarIndex: -1,
      colorbars: [],
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
    this._removeAllColorbars();
    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  on(event: ColorbarGuiEvent, handler: ColorbarGuiEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  off(event: ColorbarGuiEvent, handler: ColorbarGuiEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(event: ColorbarGuiEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: { ...this._state } };
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

  getState(): ColorbarGuiControlState {
    return {
      ...this._state,
      colorbars: this._colorbarEntries.map((entry) => ({ ...entry })),
    };
  }

  setState(state: Partial<ColorbarGuiControlState>): this {
    if (this._map) {
      this._colorbars.forEach((colorbar) => {
        this._map!.removeControl(colorbar);
      });
    }

    const entries = (state.colorbars ?? []).map((entry) => ({ ...entry }));
    this._colorbars = [];
    this._colorbarEntries = entries;

    if (this._map) {
      entries.forEach((entry) => {
        const colorbar = this._createColorbar(entry);
        this._map!.addControl(colorbar, entry.colorbarPosition);
        this._colorbars.push(colorbar);
      });
    }

    const selectedIndex =
      typeof state.selectedColorbarIndex === "number" &&
      state.selectedColorbarIndex >= 0 &&
      state.selectedColorbarIndex < entries.length
        ? state.selectedColorbarIndex
        : entries.length > 0
          ? entries.length - 1
          : -1;
    const formEntry =
      selectedIndex >= 0
        ? entries[selectedIndex]
        : {
            mode: state.mode ?? this._state.mode,
            colormap: state.colormap ?? this._state.colormap,
            customColors: state.customColors ?? this._state.customColors,
            vmin: state.vmin ?? this._state.vmin,
            vmax: state.vmax ?? this._state.vmax,
            label: state.label ?? this._state.label,
            units: state.units ?? this._state.units,
            orientation: state.orientation ?? this._state.orientation,
            colorbarPosition:
              state.colorbarPosition ?? this._state.colorbarPosition,
          };

    this._state = {
      ...this._state,
      ...formEntry,
      visible: state.visible ?? this._state.visible,
      collapsed: state.collapsed ?? this._state.collapsed,
      hasColorbar: entries.length > 0,
      selectedColorbarIndex: selectedIndex,
      colorbars: entries.map((entry) => ({ ...entry })),
    };
    this._colorbar =
      selectedIndex >= 0 ? this._colorbars[selectedIndex] : undefined;

    this._applyEntryToForm(formEntry);
    if (this._state.collapsed) this._hidePanel();
    else this._showPanel();
    if (this._container) {
      this._container.style.display =
        this._state.visible && this._zoomVisible ? "" : "none";
    }
    this._updateButtonStates();
    this._emit("colorbarupdate");
    return this;
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-colorbar-gui-control ${this._options.className}`;
    if (!this._state.visible) {
      container.style.display = "none";
    }

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "colorbar-gui-button";
    this._button.title = "Colorbar";
    this._button.innerHTML = COLORBAR_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `colorbar-gui-panel ${this._options.position.includes("left") ? "right" : "left"}`;
    panel.style.width = `${this._options.panelWidth}px`;
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
    header.className = "colorbar-gui-header";
    header.innerHTML = `
      <span>Colorbar</span>
      <button type="button" class="colorbar-gui-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".colorbar-gui-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "colorbar-gui-content";

    const selectorField = this._createField("Colorbar");
    this._colorbarSelect = document.createElement("select");
    this._colorbarSelect.className = "colorbar-gui-select";
    this._colorbarSelect.addEventListener("change", () => {
      this._selectColorbar(parseInt(this._colorbarSelect!.value, 10));
    });
    selectorField.appendChild(this._colorbarSelect);
    content.appendChild(selectorField);
    this._renderColorbarSelect();

    // Mode selector
    const modeField = this._createField("Color Source");
    const modeRow = document.createElement("div");
    modeRow.className = "colorbar-gui-mode-row";

    const namedLabel = document.createElement("label");
    namedLabel.className = "colorbar-gui-radio-label";
    this._modeNamedRadio = document.createElement("input");
    this._modeNamedRadio.type = "radio";
    this._modeNamedRadio.name = "colorbar-mode";
    this._modeNamedRadio.checked = this._state.mode === "named";
    this._modeNamedRadio.addEventListener("change", () => {
      if (this._modeNamedRadio!.checked) this._setMode("named");
    });
    namedLabel.appendChild(this._modeNamedRadio);
    namedLabel.appendChild(document.createTextNode(" Named Colormap"));
    modeRow.appendChild(namedLabel);

    const customLabel = document.createElement("label");
    customLabel.className = "colorbar-gui-radio-label";
    this._modeCustomRadio = document.createElement("input");
    this._modeCustomRadio.type = "radio";
    this._modeCustomRadio.name = "colorbar-mode";
    this._modeCustomRadio.checked = this._state.mode === "custom";
    this._modeCustomRadio.addEventListener("change", () => {
      if (this._modeCustomRadio!.checked) this._setMode("custom");
    });
    customLabel.appendChild(this._modeCustomRadio);
    customLabel.appendChild(document.createTextNode(" Custom Colors"));
    modeRow.appendChild(customLabel);

    modeField.appendChild(modeRow);
    content.appendChild(modeField);

    // Named colormap section
    this._namedSection = document.createElement("div");
    const colormapField = this._createField("Colormap");
    this._colormapSelect = document.createElement("select");
    this._colormapSelect.className = "colorbar-gui-select";
    const colormapNames = getColormapNames();
    colormapNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.selected = name === this._state.colormap;
      this._colormapSelect!.appendChild(opt);
    });
    this._colormapSelect.addEventListener("change", () => {
      this._state.colormap = this._colormapSelect!.value as ColormapName;
      this._updatePreview();
    });
    colormapField.appendChild(this._colormapSelect);
    this._namedSection.appendChild(colormapField);
    content.appendChild(this._namedSection);

    // Custom colors section
    this._customSection = document.createElement("div");
    const customField = this._createField("Colors (comma-separated)");
    this._customColorsTextarea = document.createElement("textarea");
    this._customColorsTextarea.className = "colorbar-gui-textarea";
    this._customColorsTextarea.rows = 3;
    this._customColorsTextarea.value = this._state.customColors;
    this._customColorsTextarea.placeholder =
      "e.g., red, #00ff00, blue, yellow\nor #440154, #21918c, #fde725";
    this._customColorsTextarea.addEventListener("input", () => {
      this._state.customColors = this._customColorsTextarea!.value;
      this._updatePreview();
    });
    customField.appendChild(this._customColorsTextarea);
    this._customSection.appendChild(customField);
    content.appendChild(this._customSection);

    // Show/hide sections based on mode
    this._namedSection.style.display =
      this._state.mode === "named" ? "" : "none";
    this._customSection.style.display =
      this._state.mode === "custom" ? "" : "none";

    // Preview
    this._previewEl = document.createElement("div");
    this._previewEl.className = "colorbar-gui-preview";
    content.appendChild(this._previewEl);
    this._updatePreview();

    // Value range row
    const rangeRow = document.createElement("div");
    rangeRow.className = "colorbar-gui-row";

    const vminField = this._createField("Min Value");
    this._vminInput = document.createElement("input");
    this._vminInput.type = "number";
    this._vminInput.className = "colorbar-gui-input";
    this._vminInput.value = String(this._state.vmin);
    this._vminInput.addEventListener("input", () => {
      this._state.vmin = parseFloat(this._vminInput!.value) || 0;
    });
    vminField.appendChild(this._vminInput);
    rangeRow.appendChild(vminField);

    const vmaxField = this._createField("Max Value");
    this._vmaxInput = document.createElement("input");
    this._vmaxInput.type = "number";
    this._vmaxInput.className = "colorbar-gui-input";
    this._vmaxInput.value = String(this._state.vmax);
    this._vmaxInput.addEventListener("input", () => {
      this._state.vmax = parseFloat(this._vmaxInput!.value) || 1;
    });
    vmaxField.appendChild(this._vmaxInput);
    rangeRow.appendChild(vmaxField);
    content.appendChild(rangeRow);

    // Label
    const labelField = this._createField("Label");
    this._labelInput = document.createElement("input");
    this._labelInput.type = "text";
    this._labelInput.className = "colorbar-gui-input";
    this._labelInput.placeholder = "e.g., Temperature";
    this._labelInput.value = this._state.label;
    this._labelInput.addEventListener("input", () => {
      this._state.label = this._labelInput!.value;
    });
    labelField.appendChild(this._labelInput);
    content.appendChild(labelField);

    // Units
    const unitsField = this._createField("Units");
    this._unitsInput = document.createElement("input");
    this._unitsInput.type = "text";
    this._unitsInput.className = "colorbar-gui-input";
    this._unitsInput.placeholder = "e.g., °C";
    this._unitsInput.value = this._state.units;
    this._unitsInput.addEventListener("input", () => {
      this._state.units = this._unitsInput!.value;
    });
    unitsField.appendChild(this._unitsInput);
    content.appendChild(unitsField);

    // Orientation & Position row
    const optRow = document.createElement("div");
    optRow.className = "colorbar-gui-row";

    const orientField = this._createField("Orientation");
    this._orientationSelect = document.createElement("select");
    this._orientationSelect.className = "colorbar-gui-select";
    (["horizontal", "vertical"] as ColorbarOrientation[]).forEach((orient) => {
      const opt = document.createElement("option");
      opt.value = orient;
      opt.textContent = orient.charAt(0).toUpperCase() + orient.slice(1);
      opt.selected = orient === this._state.orientation;
      this._orientationSelect!.appendChild(opt);
    });
    this._orientationSelect.addEventListener("change", () => {
      this._state.orientation = this._orientationSelect!
        .value as ColorbarOrientation;
    });
    orientField.appendChild(this._orientationSelect);
    optRow.appendChild(orientField);

    const posField = this._createField("Position");
    this._positionSelect = document.createElement("select");
    this._positionSelect.className = "colorbar-gui-select";
    const positions: { value: string; label: string }[] = [
      { value: "top-left", label: "Top Left" },
      { value: "top-right", label: "Top Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom-right", label: "Bottom Right" },
    ];
    positions.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      opt.selected = p.value === this._state.colorbarPosition;
      this._positionSelect!.appendChild(opt);
    });
    this._positionSelect.addEventListener("change", () => {
      this._state.colorbarPosition = this._positionSelect!
        .value as ControlPosition;
    });
    posField.appendChild(this._positionSelect);
    optRow.appendChild(posField);
    content.appendChild(optRow);

    // Buttons
    this._addBtn = document.createElement("button");
    this._addBtn.type = "button";
    this._addBtn.className = "colorbar-gui-add-btn";
    this._addBtn.textContent = "Add Colorbar";
    this._addBtn.addEventListener("click", () => this._addColorbar());
    content.appendChild(this._addBtn);

    const updateBtn = document.createElement("button");
    updateBtn.type = "button";
    updateBtn.className = "colorbar-gui-add-btn";
    updateBtn.textContent = "Update Selected Colorbar";
    updateBtn.style.display = this._state.hasColorbar ? "" : "none";
    updateBtn.addEventListener("click", () => this._updateColorbar());
    content.appendChild(updateBtn);
    this._updateBtn = updateBtn;

    this._removeBtn = document.createElement("button");
    this._removeBtn.type = "button";
    this._removeBtn.className = "colorbar-gui-remove-btn";
    this._removeBtn.textContent = "Remove Colorbar";
    this._removeBtn.style.display = this._state.hasColorbar ? "" : "none";
    this._removeBtn.addEventListener("click", () => this._removeColorbar());
    content.appendChild(this._removeBtn);

    panel.appendChild(content);
    return panel;
  }

  private _createField(label: string): HTMLElement {
    const field = document.createElement("div");
    field.className = "colorbar-gui-field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    field.appendChild(lbl);
    return field;
  }

  private _setMode(mode: "named" | "custom"): void {
    this._state.mode = mode;
    if (this._namedSection) {
      this._namedSection.style.display = mode === "named" ? "" : "none";
    }
    if (this._customSection) {
      this._customSection.style.display = mode === "custom" ? "" : "none";
    }
    this._updatePreview();
  }

  private _parseCustomColors(): string[] {
    return this._state.customColors
      .split(/[,\n]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }

  private _updatePreview(): void {
    if (!this._previewEl) return;
    if (this._state.mode === "custom") {
      const colors = this._parseCustomColors();
      if (colors.length === 0) {
        this._previewEl.style.background = "#e5e7eb";
        return;
      }
      if (colors.length === 1) {
        this._previewEl.style.background = colors[0];
        return;
      }
      const step = 100 / (colors.length - 1);
      const gradientStops = colors
        .map((c, i) => `${c} ${(i * step).toFixed(1)}%`)
        .join(", ");
      this._previewEl.style.background = `linear-gradient(to right, ${gradientStops})`;
    } else {
      const name = this._state.colormap;
      const stops = getColormap(name);
      const gradientStops = stops
        .map((s) => `${s.color} ${s.position * 100}%`)
        .join(", ");
      this._previewEl.style.background = `linear-gradient(to right, ${gradientStops})`;
    }
  }

  private _getFormEntry(): ColorbarGuiEntryState {
    return {
      mode: this._state.mode,
      colormap: this._state.colormap,
      customColors: this._state.customColors,
      vmin: this._state.vmin,
      vmax: this._state.vmax,
      label: this._state.label,
      units: this._state.units,
      orientation: this._state.orientation,
      colorbarPosition: this._state.colorbarPosition,
    };
  }

  private _applyEntryToForm(entry: ColorbarGuiEntryState): void {
    this._state.mode = entry.mode;
    this._state.colormap = entry.colormap;
    this._state.customColors = entry.customColors;
    this._state.vmin = entry.vmin;
    this._state.vmax = entry.vmax;
    this._state.label = entry.label;
    this._state.units = entry.units;
    this._state.orientation = entry.orientation;
    this._state.colorbarPosition = entry.colorbarPosition;

    if (this._modeNamedRadio)
      this._modeNamedRadio.checked = entry.mode === "named";
    if (this._modeCustomRadio)
      this._modeCustomRadio.checked = entry.mode === "custom";
    if (this._namedSection) {
      this._namedSection.style.display = entry.mode === "named" ? "" : "none";
    }
    if (this._customSection) {
      this._customSection.style.display = entry.mode === "custom" ? "" : "none";
    }
    if (this._colormapSelect) this._colormapSelect.value = entry.colormap;
    if (this._customColorsTextarea)
      this._customColorsTextarea.value = entry.customColors;
    if (this._vminInput) this._vminInput.value = String(entry.vmin);
    if (this._vmaxInput) this._vmaxInput.value = String(entry.vmax);
    if (this._labelInput) this._labelInput.value = entry.label;
    if (this._unitsInput) this._unitsInput.value = entry.units;
    if (this._orientationSelect)
      this._orientationSelect.value = entry.orientation;
    if (this._positionSelect)
      this._positionSelect.value = entry.colorbarPosition;
    this._updatePreview();
  }

  private _createColorbar(entry: ColorbarGuiEntryState): Colorbar {
    const colormap =
      entry.mode === "custom"
        ? entry.customColors
            .split(/[,\n]+/)
            .map((color) => color.trim())
            .filter((color) => color.length > 0)
        : entry.colormap;

    return new Colorbar({
      colormap:
        Array.isArray(colormap) && colormap.length === 0
          ? ["#440154", "#21918c", "#fde725"]
          : colormap,
      vmin: entry.vmin,
      vmax: entry.vmax,
      label: entry.label,
      units: entry.units,
      orientation: entry.orientation,
      position: entry.colorbarPosition,
    });
  }

  private _selectColorbar(index: number): void {
    if (index < 0) {
      this._state.selectedColorbarIndex = -1;
      this._colorbar = undefined;
      this._updateButtonStates();
      return;
    }
    if (index >= this._colorbarEntries.length) return;
    this._state.selectedColorbarIndex = index;
    this._colorbar = this._colorbars[index];
    this._applyEntryToForm(this._colorbarEntries[index]);
    this._updateButtonStates();
  }

  private _renderColorbarSelect(): void {
    if (!this._colorbarSelect) return;
    this._colorbarSelect.innerHTML = "";

    const newOpt = document.createElement("option");
    newOpt.value = "-1";
    newOpt.textContent = "New colorbar";
    this._colorbarSelect.appendChild(newOpt);

    this._colorbarEntries.forEach((entry, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = entry.label || `Colorbar ${index + 1}`;
      this._colorbarSelect!.appendChild(opt);
    });
    this._colorbarSelect.value =
      this._state.selectedColorbarIndex >= 0
        ? String(this._state.selectedColorbarIndex)
        : "-1";
  }

  private _addColorbar(): void {
    if (!this._map) return;
    const entry = this._getFormEntry();
    const colorbar = this._createColorbar(entry);
    this._map.addControl(colorbar, entry.colorbarPosition);
    this._colorbars.push(colorbar);
    this._colorbarEntries.push(entry);
    this._colorbar = colorbar;
    this._state.hasColorbar = true;
    this._state.selectedColorbarIndex = this._colorbars.length - 1;
    this._state.colorbars = this._colorbarEntries.map((item) => ({ ...item }));
    this._updateButtonStates();
    this._emit("colorbaradd");
  }

  private _updateColorbar(): void {
    if (!this._map) return;
    const index = this._state.selectedColorbarIndex;
    if (index < 0 || index >= this._colorbars.length) {
      this._addColorbar();
      return;
    }

    const entry = this._getFormEntry();
    this._map.removeControl(this._colorbars[index]);
    const colorbar = this._createColorbar(entry);
    this._map.addControl(colorbar, entry.colorbarPosition);
    this._colorbars[index] = colorbar;
    this._colorbarEntries[index] = entry;
    this._colorbar = colorbar;
    this._state.colorbars = this._colorbarEntries.map((item) => ({ ...item }));
    this._emit("colorbarupdate");
    this._updateButtonStates();
  }

  private _removeColorbar(): void {
    if (!this._map) return;
    const index = this._state.selectedColorbarIndex;
    if (index < 0 || index >= this._colorbars.length) return;

    this._map.removeControl(this._colorbars[index]);
    this._colorbars.splice(index, 1);
    this._colorbarEntries.splice(index, 1);
    this._state.hasColorbar = this._colorbars.length > 0;
    this._state.selectedColorbarIndex = this._state.hasColorbar
      ? Math.min(index, this._colorbars.length - 1)
      : -1;
    this._colorbar =
      this._state.selectedColorbarIndex >= 0
        ? this._colorbars[this._state.selectedColorbarIndex]
        : undefined;
    this._state.colorbars = this._colorbarEntries.map((item) => ({ ...item }));
    if (this._state.selectedColorbarIndex >= 0) {
      this._applyEntryToForm(
        this._colorbarEntries[this._state.selectedColorbarIndex],
      );
    }
    this._updateButtonStates();
    this._emit("colorbarremove");
  }

  private _removeAllColorbars(): void {
    if (!this._map) return;
    this._colorbars.forEach((colorbar) => {
      this._map!.removeControl(colorbar);
    });
    this._colorbars = [];
    this._colorbarEntries = [];
    this._colorbar = undefined;
    this._state.hasColorbar = false;
    this._state.selectedColorbarIndex = -1;
    this._state.colorbars = [];
    this._updateButtonStates();
  }

  private _updateButtonStates(): void {
    if (this._addBtn) {
      this._addBtn.textContent = "Add Colorbar";
    }
    const hasSelection = this._state.selectedColorbarIndex >= 0;
    if (this._updateBtn) {
      this._updateBtn.style.display = hasSelection ? "" : "none";
    }
    if (this._removeBtn) {
      this._removeBtn.style.display = hasSelection ? "" : "none";
    }
    this._renderColorbarSelect();
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
   * Get the active Colorbar instance (if any).
   */
  getColorbar(): Colorbar | undefined {
    return this._colorbar;
  }
}
