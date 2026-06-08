import "../styles/common.css";
import "../styles/print-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  PrintControlOptions,
  PrintControlState,
  PrintEvent,
  PrintEventHandler,
  PrintColorbarConfig,
  PrintPageSize,
  PrintOrientation,
  PrintFitMode,
  PrintFormat,
  PrintTheme,
  ColormapName,
  ColorStop,
} from "./types";
import { getColormap, isValidColormap, getColormapNames } from "../colormaps";

/**
 * Default colorbar configuration.
 */
const DEFAULT_COLORBAR: Required<PrintColorbarConfig> = {
  enabled: false,
  colormap: "viridis",
  vmin: 0,
  vmax: 1,
  label: "",
  units: "",
  orientation: "vertical",
  position: "bottom-right",
  barThickness: 20,
  barLength: 150,
  tickCount: 5,
};

/**
 * Default options for the PrintControl.
 */
const DEFAULT_OPTIONS: Required<Omit<PrintControlOptions, "colorbar">> & {
  colorbar: Required<PrintColorbarConfig>;
} = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  theme: "auto",
  format: "png",
  quality: 0.92,
  filename: "map-export",
  title: "",
  includeNorthArrow: false,
  includeScaleBar: false,
  colorbar: DEFAULT_COLORBAR,
  titleFontSize: 24,
  titleFontColor: "#333333",
  titleBackground: "rgba(255,255,255,0.8)",
  showSizeOptions: false,
  width: 0,
  height: 0,
  pageSize: "fit",
  orientation: "auto",
  dpi: 96,
  margin: 0,
  pageBackground: "#ffffff",
  fitMode: "contain",
  showPageOptions: false,
  panelWidth: 280,
  maxHeight: 500,
  backgroundColor: "",
  borderRadius: 4,
  opacity: 1,
  fontSize: 12,
  fontColor: "",
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG printer icon for the export/print button.
 */
const PRINTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

/**
 * Physical paper sizes in inches (portrait orientation: width x height).
 */
const PAGE_SIZES_INCHES: Record<
  Exclude<PrintPageSize, "fit">,
  [number, number]
> = {
  a3: [11.69, 16.54],
  a4: [8.27, 11.69],
  a5: [5.83, 8.27],
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
};

/**
 * SVG icon for close button.
 */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * SVG icon for download.
 */
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/**
 * SVG icon for clipboard copy.
 */
const CLIPBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

/**
 * A rectangle in export-canvas pixel coordinates.
 */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolved layout for an export page.
 */
interface PageLayout {
  /** Export canvas width in pixels. */
  pageW: number;
  /** Export canvas height in pixels. */
  pageH: number;
  /** Content area (page minus margins) where overlays are positioned. */
  content: Rect;
  /** Destination rectangle the map image is drawn into. */
  mapDest: Rect;
  /** Export pixels per source map pixel (used for an accurate scale bar). */
  scaleX: number;
  /** Whether the map is clipped to the content rect (cover/crop mode). */
  clip: boolean;
  /** Physical page width in inches (null when unknown). */
  pageWidthIn: number | null;
  /** Physical page height in inches (null when unknown). */
  pageHeightIn: number | null;
}

/**
 * A control for exporting the current map view as an image.
 *
 * @example
 * ```typescript
 * const printControl = new PrintControl({
 *   filename: 'my-map',
 *   format: 'png',
 * });
 * map.addControl(printControl, 'top-right');
 *
 * printControl.on('export', (event) => {
 *   console.log('Map exported:', event.state.filename);
 * });
 * ```
 */
export class PrintControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<Omit<PrintControlOptions, "colorbar">> & {
    colorbar: Required<PrintColorbarConfig>;
  };
  private _state: PrintControlState;
  private _eventHandlers: Map<PrintEvent, Set<PrintEventHandler>> = new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // DOM elements
  private _titleInput?: HTMLInputElement;
  private _northArrowInput?: HTMLInputElement;
  private _scaleBarInput?: HTMLInputElement;
  private _colorbarInput?: HTMLInputElement;
  private _colorbarSettingsDiv?: HTMLElement;
  private _colorbarColormapSelect?: HTMLSelectElement;
  private _colorbarOrientationSelect?: HTMLSelectElement;
  private _colorbarVminInput?: HTMLInputElement;
  private _colorbarVmaxInput?: HTMLInputElement;
  private _colorbarLabelInput?: HTMLInputElement;
  private _colorbarUnitsInput?: HTMLInputElement;
  private _filenameInput?: HTMLInputElement;
  private _formatSelect?: HTMLSelectElement;
  private _qualityInput?: HTMLInputElement;
  private _qualityValue?: HTMLSpanElement;
  private _qualityField?: HTMLElement;
  private _sizeRadioCurrent?: HTMLInputElement;
  private _sizeRadioCustom?: HTMLInputElement;
  private _widthInput?: HTMLInputElement;
  private _heightInput?: HTMLInputElement;
  private _customSizeInputs?: HTMLElement;
  private _pageSizeSelect?: HTMLSelectElement;
  private _orientationSelect?: HTMLSelectElement;
  private _dpiSelect?: HTMLSelectElement;
  private _marginInput?: HTMLInputElement;
  private _fitModeSelect?: HTMLSelectElement;
  private _pageBackgroundInput?: HTMLInputElement;
  private _exportBtn?: HTMLButtonElement;
  private _copyBtn?: HTMLButtonElement;
  private _feedbackEl?: HTMLElement;

  /**
   * Creates a new PrintControl instance.
   */
  constructor(options?: PrintControlOptions) {
    const colorbar = { ...DEFAULT_COLORBAR, ...options?.colorbar };
    this._options = { ...DEFAULT_OPTIONS, ...options, colorbar };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      format: this._options.format,
      quality: this._options.quality,
      filename: this._options.filename,
      title: this._options.title,
      includeNorthArrow: this._options.includeNorthArrow,
      includeScaleBar: this._options.includeScaleBar,
      colorbar: { ...colorbar },
      exporting: false,
      width: this._options.width || null,
      height: this._options.height || null,
      pageSize: this._options.pageSize,
      orientation: this._options.orientation,
      dpi: this._options.dpi,
      margin: this._options.margin,
      pageBackground: this._options.pageBackground,
      fitMode: this._options.fitMode,
    };
  }

  /**
   * Called when the control is added to the map.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._setupZoomHandler();

    if (!this._state.collapsed) {
      this._showPanel();
    }

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    if (this._handleZoom && this._map) {
      this._map.off("zoom", this._handleZoom);
    }

    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  /**
   * Get the default position for this control.
   */
  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  /**
   * Register an event handler.
   */
  on(event: PrintEvent, handler: PrintEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: PrintEvent, handler: PrintEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  /**
   * Emit an event to registered handlers.
   */
  private _emit(
    event: PrintEvent,
    extra?: { dataUrl?: string; error?: string },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = {
        type: event,
        state: { ...this._state },
        ...extra,
      };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Create the control container.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-print-control ${this._options.className}`;
    this._applyThemeClass(container);

    if (!this._state.visible) {
      container.style.display = "none";
    }

    // Main button
    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "print-button";
    this._button.title = "Export Map";
    this._button.innerHTML = PRINTER_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  /**
   * Create the panel content.
   */
  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `print-panel ${this._options.position.includes("left") ? "right" : "left"}`;
    panel.style.width = `${this._options.panelWidth}px`;
    if (this._options.maxHeight && this._options.maxHeight > 0) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
      panel.style.overflowY = "auto";
    }
    // Only force colors when explicitly provided; otherwise the CSS custom
    // properties drive them so the panel adapts to the system theme.
    if (this._options.backgroundColor) {
      panel.style.background = this._options.backgroundColor;
    }
    panel.style.borderRadius = `${this._options.borderRadius}px`;
    panel.style.fontSize = `${this._options.fontSize}px`;
    if (this._options.fontColor) {
      panel.style.color = this._options.fontColor;
    }

    // Header
    const header = document.createElement("div");
    header.className = "print-header";
    header.innerHTML = `
      <span>Export Map</span>
      <button type="button" class="print-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".print-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "print-content";

    // Title field
    const titleField = document.createElement("div");
    titleField.className = "print-field";
    titleField.innerHTML = `<label>Title (optional)</label>`;
    this._titleInput = document.createElement("input");
    this._titleInput.type = "text";
    this._titleInput.className = "print-input";
    this._titleInput.style.color = "var(--print-input-text)";
    this._titleInput.placeholder = "Enter a title...";
    this._titleInput.value = this._state.title;
    this._titleInput.addEventListener("input", () => {
      this._state.title = this._titleInput!.value;
    });
    titleField.appendChild(this._titleInput);
    content.appendChild(titleField);

    // Optional map elements
    const elementsField = document.createElement("div");
    elementsField.className = "print-field";
    elementsField.innerHTML = `<label>Map elements</label>`;

    const northArrowLabel = document.createElement("label");
    northArrowLabel.className = "print-checkbox-label";
    this._northArrowInput = document.createElement("input");
    this._northArrowInput.type = "checkbox";
    this._northArrowInput.checked = this._state.includeNorthArrow;
    this._northArrowInput.addEventListener("change", () => {
      this._state.includeNorthArrow = !!this._northArrowInput?.checked;
    });
    northArrowLabel.appendChild(this._northArrowInput);
    northArrowLabel.appendChild(
      document.createTextNode(" Include north arrow"),
    );

    const scaleBarLabel = document.createElement("label");
    scaleBarLabel.className = "print-checkbox-label";
    this._scaleBarInput = document.createElement("input");
    this._scaleBarInput.type = "checkbox";
    this._scaleBarInput.checked = this._state.includeScaleBar;
    this._scaleBarInput.addEventListener("change", () => {
      this._state.includeScaleBar = !!this._scaleBarInput?.checked;
    });
    scaleBarLabel.appendChild(this._scaleBarInput);
    scaleBarLabel.appendChild(document.createTextNode(" Include scale bar"));

    const colorbarLabel = document.createElement("label");
    colorbarLabel.className = "print-checkbox-label";
    this._colorbarInput = document.createElement("input");
    this._colorbarInput.type = "checkbox";
    this._colorbarInput.checked = this._state.colorbar.enabled ?? false;
    this._colorbarInput.addEventListener("change", () => {
      this._state.colorbar.enabled = !!this._colorbarInput?.checked;
      this._updateColorbarSettingsVisibility();
    });
    colorbarLabel.appendChild(this._colorbarInput);
    colorbarLabel.appendChild(document.createTextNode(" Include colorbar"));

    elementsField.appendChild(northArrowLabel);
    elementsField.appendChild(scaleBarLabel);
    elementsField.appendChild(colorbarLabel);
    content.appendChild(elementsField);

    // Colorbar settings (collapsible)
    this._colorbarSettingsDiv = document.createElement("div");
    this._colorbarSettingsDiv.className = "print-field print-colorbar-settings";
    this._colorbarSettingsDiv.innerHTML = `<label>Colorbar Settings</label>`;

    // Colormap select
    const colormapRow = document.createElement("div");
    colormapRow.className = "print-colorbar-row";
    const colormapLabel = document.createElement("span");
    colormapLabel.textContent = "Colormap:";
    colormapLabel.className = "print-colorbar-sublabel";
    this._colorbarColormapSelect = document.createElement("select");
    this._colorbarColormapSelect.className =
      "print-select print-colorbar-select";
    this._colorbarColormapSelect.style.color = "var(--print-input-text)";
    const colormapNames = getColormapNames();
    colormapNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.selected = name === this._state.colorbar.colormap;
      this._colorbarColormapSelect!.appendChild(opt);
    });
    this._colorbarColormapSelect.addEventListener("change", () => {
      this._state.colorbar.colormap = this._colorbarColormapSelect!
        .value as ColormapName;
    });
    colormapRow.appendChild(colormapLabel);
    colormapRow.appendChild(this._colorbarColormapSelect);
    this._colorbarSettingsDiv.appendChild(colormapRow);

    // Orientation row
    const orientationRow = document.createElement("div");
    orientationRow.className = "print-colorbar-row";
    const orientationLabel = document.createElement("span");
    orientationLabel.textContent = "Orientation:";
    orientationLabel.className = "print-colorbar-sublabel";
    this._colorbarOrientationSelect = document.createElement("select");
    this._colorbarOrientationSelect.className =
      "print-select print-colorbar-select";
    this._colorbarOrientationSelect.style.color = "var(--print-input-text)";
    const orientations: Array<"horizontal" | "vertical"> = [
      "horizontal",
      "vertical",
    ];
    orientations.forEach((orient) => {
      const opt = document.createElement("option");
      opt.value = orient;
      opt.textContent = orient.charAt(0).toUpperCase() + orient.slice(1);
      opt.selected =
        orient === (this._state.colorbar.orientation ?? "vertical");
      this._colorbarOrientationSelect!.appendChild(opt);
    });
    this._colorbarOrientationSelect.addEventListener("change", () => {
      this._state.colorbar.orientation = this._colorbarOrientationSelect!
        .value as "horizontal" | "vertical";
    });
    orientationRow.appendChild(orientationLabel);
    orientationRow.appendChild(this._colorbarOrientationSelect);
    this._colorbarSettingsDiv.appendChild(orientationRow);

    // Vmin/Vmax row
    const rangeRow = document.createElement("div");
    rangeRow.className = "print-colorbar-row";
    const vminLabel = document.createElement("span");
    vminLabel.textContent = "Min:";
    vminLabel.className = "print-colorbar-sublabel";
    this._colorbarVminInput = document.createElement("input");
    this._colorbarVminInput.type = "number";
    this._colorbarVminInput.className = "print-input print-colorbar-num";
    this._colorbarVminInput.style.color = "var(--print-input-text)";
    this._colorbarVminInput.value = String(this._state.colorbar.vmin ?? 0);
    this._colorbarVminInput.addEventListener("input", () => {
      this._state.colorbar.vmin =
        parseFloat(this._colorbarVminInput!.value) || 0;
    });
    const vmaxLabel = document.createElement("span");
    vmaxLabel.textContent = "Max:";
    vmaxLabel.className = "print-colorbar-sublabel";
    this._colorbarVmaxInput = document.createElement("input");
    this._colorbarVmaxInput.type = "number";
    this._colorbarVmaxInput.className = "print-input print-colorbar-num";
    this._colorbarVmaxInput.style.color = "var(--print-input-text)";
    this._colorbarVmaxInput.value = String(this._state.colorbar.vmax ?? 1);
    this._colorbarVmaxInput.addEventListener("input", () => {
      this._state.colorbar.vmax =
        parseFloat(this._colorbarVmaxInput!.value) || 1;
    });
    rangeRow.appendChild(vminLabel);
    rangeRow.appendChild(this._colorbarVminInput);
    rangeRow.appendChild(vmaxLabel);
    rangeRow.appendChild(this._colorbarVmaxInput);
    this._colorbarSettingsDiv.appendChild(rangeRow);

    // Label row
    const labelRow = document.createElement("div");
    labelRow.className = "print-colorbar-row";
    const labelLabel = document.createElement("span");
    labelLabel.textContent = "Label:";
    labelLabel.className = "print-colorbar-sublabel";
    this._colorbarLabelInput = document.createElement("input");
    this._colorbarLabelInput.type = "text";
    this._colorbarLabelInput.className = "print-input";
    this._colorbarLabelInput.style.color = "var(--print-input-text)";
    this._colorbarLabelInput.placeholder = "e.g., Temperature";
    this._colorbarLabelInput.value = this._state.colorbar.label ?? "";
    this._colorbarLabelInput.addEventListener("input", () => {
      this._state.colorbar.label = this._colorbarLabelInput!.value;
    });
    labelRow.appendChild(labelLabel);
    labelRow.appendChild(this._colorbarLabelInput);
    this._colorbarSettingsDiv.appendChild(labelRow);

    // Units row
    const unitsRow = document.createElement("div");
    unitsRow.className = "print-colorbar-row";
    const unitsLabel = document.createElement("span");
    unitsLabel.textContent = "Units:";
    unitsLabel.className = "print-colorbar-sublabel";
    this._colorbarUnitsInput = document.createElement("input");
    this._colorbarUnitsInput.type = "text";
    this._colorbarUnitsInput.className = "print-input print-colorbar-units";
    this._colorbarUnitsInput.style.color = "var(--print-input-text)";
    this._colorbarUnitsInput.placeholder = "e.g., °C";
    this._colorbarUnitsInput.value = this._state.colorbar.units ?? "";
    this._colorbarUnitsInput.addEventListener("input", () => {
      this._state.colorbar.units = this._colorbarUnitsInput!.value;
    });
    unitsRow.appendChild(unitsLabel);
    unitsRow.appendChild(this._colorbarUnitsInput);
    this._colorbarSettingsDiv.appendChild(unitsRow);

    content.appendChild(this._colorbarSettingsDiv);
    this._updateColorbarSettingsVisibility();

    // Filename field
    const filenameField = document.createElement("div");
    filenameField.className = "print-field";
    filenameField.innerHTML = `<label>Filename</label>`;
    this._filenameInput = document.createElement("input");
    this._filenameInput.type = "text";
    this._filenameInput.className = "print-input";
    this._filenameInput.style.color = "var(--print-input-text)";
    this._filenameInput.value = this._state.filename;
    this._filenameInput.addEventListener("input", () => {
      this._state.filename = this._filenameInput!.value || "map-export";
    });
    filenameField.appendChild(this._filenameInput);
    content.appendChild(filenameField);

    // Format and Quality row
    const row = document.createElement("div");
    row.className = "print-row";

    // Format field
    const formatField = document.createElement("div");
    formatField.className = "print-field";
    formatField.innerHTML = `<label>Format</label>`;
    this._formatSelect = document.createElement("select");
    this._formatSelect.className = "print-select";
    this._formatSelect.style.color = "var(--print-input-text)";
    this._formatSelect.innerHTML = `
      <option value="png" ${this._state.format === "png" ? "selected" : ""}>PNG</option>
      <option value="jpeg" ${this._state.format === "jpeg" ? "selected" : ""}>JPEG</option>
      <option value="pdf" ${this._state.format === "pdf" ? "selected" : ""}>PDF</option>
      <option value="svg" ${this._state.format === "svg" ? "selected" : ""}>SVG</option>
    `;
    this._formatSelect.addEventListener("change", () => {
      this._state.format = this._formatSelect!.value as PrintFormat;
      this._updateQualityVisibility();
      this._updateCopyBtnVisibility();
    });
    formatField.appendChild(this._formatSelect);
    row.appendChild(formatField);

    // Quality field
    this._qualityField = document.createElement("div");
    this._qualityField.className = "print-field";
    this._qualityField.innerHTML = `<label>Quality</label>`;
    const qualityWrapper = document.createElement("div");
    qualityWrapper.className = "print-quality-wrapper";
    this._qualityInput = document.createElement("input");
    this._qualityInput.type = "range";
    this._qualityInput.className = "print-quality-range";
    this._qualityInput.style.color = "var(--print-input-text)";
    this._qualityInput.min = "0.1";
    this._qualityInput.max = "1";
    this._qualityInput.step = "0.01";
    this._qualityInput.value = String(this._state.quality);
    this._qualityValue = document.createElement("span");
    this._qualityValue.className = "print-quality-value";
    this._qualityValue.textContent = this._state.quality.toFixed(2);
    this._qualityInput.addEventListener("input", () => {
      this._state.quality = parseFloat(this._qualityInput!.value);
      this._qualityValue!.textContent = this._state.quality.toFixed(2);
    });
    qualityWrapper.appendChild(this._qualityInput);
    qualityWrapper.appendChild(this._qualityValue);
    this._qualityField.appendChild(qualityWrapper);
    row.appendChild(this._qualityField);

    content.appendChild(row);
    this._updateQualityVisibility();

    // Size options
    if (this._options.showSizeOptions) {
      const sizeField = document.createElement("div");
      sizeField.className = "print-field";
      sizeField.innerHTML = `<label>Size</label>`;

      const sizeOptions = document.createElement("div");
      sizeOptions.className = "print-size-options";

      // Current radio
      const currentLabel = document.createElement("label");
      currentLabel.className = "print-radio-label";
      this._sizeRadioCurrent = document.createElement("input");
      this._sizeRadioCurrent.type = "radio";
      this._sizeRadioCurrent.name = "print-size";
      this._sizeRadioCurrent.value = "current";
      this._sizeRadioCurrent.checked = !this._state.width;
      this._sizeRadioCurrent.addEventListener("change", () => {
        this._state.width = null;
        this._state.height = null;
        this._updateCustomSizeVisibility();
      });
      currentLabel.appendChild(this._sizeRadioCurrent);
      currentLabel.appendChild(document.createTextNode(" Current"));
      sizeOptions.appendChild(currentLabel);

      // Custom radio
      const customLabel = document.createElement("label");
      customLabel.className = "print-radio-label";
      this._sizeRadioCustom = document.createElement("input");
      this._sizeRadioCustom.type = "radio";
      this._sizeRadioCustom.name = "print-size";
      this._sizeRadioCustom.value = "custom";
      this._sizeRadioCustom.checked = !!this._state.width;
      this._sizeRadioCustom.addEventListener("change", () => {
        const canvas = this._map?.getCanvas();
        this._state.width = canvas ? canvas.width : 1920;
        this._state.height = canvas ? canvas.height : 1080;
        if (this._widthInput)
          this._widthInput.value = String(this._state.width);
        if (this._heightInput)
          this._heightInput.value = String(this._state.height);
        this._updateCustomSizeVisibility();
      });
      customLabel.appendChild(this._sizeRadioCustom);
      customLabel.appendChild(document.createTextNode(" Custom"));
      sizeOptions.appendChild(customLabel);

      sizeField.appendChild(sizeOptions);

      // Custom size inputs
      this._customSizeInputs = document.createElement("div");
      this._customSizeInputs.className = "print-custom-size";

      const widthLabel = document.createElement("label");
      widthLabel.className = "print-size-label";
      widthLabel.textContent = "Width";
      this._widthInput = document.createElement("input");
      this._widthInput.type = "number";
      this._widthInput.className = "print-size-input";
      this._widthInput.style.color = "var(--print-input-text)";
      this._widthInput.min = "1";
      this._widthInput.max = "8192";
      this._widthInput.value = String(this._state.width || 1920);
      this._widthInput.addEventListener("input", () => {
        this._state.width = parseInt(this._widthInput!.value) || null;
      });
      const widthGroup = document.createElement("div");
      widthGroup.className = "print-size-group";
      widthGroup.appendChild(widthLabel);
      widthGroup.appendChild(this._widthInput);

      const heightLabel = document.createElement("label");
      heightLabel.className = "print-size-label";
      heightLabel.textContent = "Height";
      this._heightInput = document.createElement("input");
      this._heightInput.type = "number";
      this._heightInput.className = "print-size-input";
      this._heightInput.style.color = "var(--print-input-text)";
      this._heightInput.min = "1";
      this._heightInput.max = "8192";
      this._heightInput.value = String(this._state.height || 1080);
      this._heightInput.addEventListener("input", () => {
        this._state.height = parseInt(this._heightInput!.value) || null;
      });
      const heightGroup = document.createElement("div");
      heightGroup.className = "print-size-group";
      heightGroup.appendChild(heightLabel);
      heightGroup.appendChild(this._heightInput);

      this._customSizeInputs.appendChild(widthGroup);
      this._customSizeInputs.appendChild(heightGroup);

      sizeField.appendChild(this._customSizeInputs);
      content.appendChild(sizeField);
      this._updateCustomSizeVisibility();
    }

    // Page options
    if (this._options.showPageOptions) {
      const pageField = document.createElement("div");
      pageField.className = "print-field";
      pageField.innerHTML = `<label>Page</label>`;
      pageField.appendChild(this._createPageOptions());
      content.appendChild(pageField);
    }

    // Export button
    this._exportBtn = document.createElement("button");
    this._exportBtn.type = "button";
    this._exportBtn.className = "print-export-btn";
    this._exportBtn.innerHTML = `${DOWNLOAD_ICON}<span>Export Map</span>`;
    this._exportBtn.addEventListener("click", () => this._exportMap());
    content.appendChild(this._exportBtn);

    // Copy to clipboard button
    this._copyBtn = document.createElement("button");
    this._copyBtn.type = "button";
    this._copyBtn.className = "print-copy-btn";
    this._copyBtn.innerHTML = `${CLIPBOARD_ICON}<span>Copy to Clipboard</span>`;
    this._copyBtn.addEventListener("click", () => this._copyToClipboard());
    content.appendChild(this._copyBtn);
    this._updateCopyBtnVisibility();

    // Feedback element
    this._feedbackEl = document.createElement("div");
    this._feedbackEl.className = "print-feedback";
    content.appendChild(this._feedbackEl);

    panel.appendChild(content);

    return panel;
  }

  /**
   * Create a labeled field wrapping a control element.
   */
  private _makeField(labelText: string, control: HTMLElement): HTMLElement {
    const field = document.createElement("div");
    field.className = "print-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    field.appendChild(label);
    field.appendChild(control);
    return field;
  }

  /**
   * Create a styled select element from value/label option pairs.
   */
  private _makeSelect(
    options: Array<[string, string]>,
    selected: string,
  ): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "print-select";
    select.style.color = "var(--print-input-text)";
    options.forEach(([value, text]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      opt.selected = value === selected;
      select.appendChild(opt);
    });
    return select;
  }

  /**
   * Normalize a color string to a 6-digit hex value usable by `<input type="color">`.
   */
  private _toHexColor(color: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
  }

  /**
   * Create the page options section (size, orientation, DPI, margin, fit, background).
   */
  private _createPageOptions(): HTMLElement {
    const wrapper = document.createElement("div");

    // Row 1: Page size + Orientation
    const row1 = document.createElement("div");
    row1.className = "print-row";

    this._pageSizeSelect = this._makeSelect(
      [
        ["fit", "Fit to map"],
        ["a3", "A3"],
        ["a4", "A4"],
        ["a5", "A5"],
        ["letter", "Letter"],
        ["legal", "Legal"],
        ["tabloid", "Tabloid"],
      ],
      this._state.pageSize,
    );
    this._pageSizeSelect.addEventListener("change", () => {
      this._state.pageSize = this._pageSizeSelect!.value as PrintPageSize;
      this._updatePageOptionsDisabled();
    });
    row1.appendChild(this._makeField("Page size", this._pageSizeSelect));

    this._orientationSelect = this._makeSelect(
      [
        ["auto", "Auto"],
        ["portrait", "Portrait"],
        ["landscape", "Landscape"],
      ],
      this._state.orientation,
    );
    this._orientationSelect.addEventListener("change", () => {
      this._state.orientation = this._orientationSelect!
        .value as PrintOrientation;
    });
    row1.appendChild(this._makeField("Orientation", this._orientationSelect));
    wrapper.appendChild(row1);

    // Row 2: DPI + Margin
    const row2 = document.createElement("div");
    row2.className = "print-row";

    this._dpiSelect = this._makeSelect(
      [
        ["72", "72"],
        ["96", "96"],
        ["150", "150"],
        ["300", "300"],
        ["600", "600"],
      ],
      String(this._state.dpi),
    );
    this._dpiSelect.addEventListener("change", () => {
      this._state.dpi = parseInt(this._dpiSelect!.value, 10) || 96;
    });
    row2.appendChild(this._makeField("DPI", this._dpiSelect));

    this._marginInput = document.createElement("input");
    this._marginInput.type = "number";
    this._marginInput.className = "print-input";
    this._marginInput.style.color = "var(--print-input-text)";
    this._marginInput.min = "0";
    this._marginInput.value = String(this._state.margin);
    this._marginInput.addEventListener("input", () => {
      this._state.margin = Math.max(
        0,
        parseFloat(this._marginInput!.value) || 0,
      );
    });
    row2.appendChild(this._makeField("Margin (pt)", this._marginInput));
    wrapper.appendChild(row2);

    // Row 3: Fit mode + Background
    const row3 = document.createElement("div");
    row3.className = "print-row";

    this._fitModeSelect = this._makeSelect(
      [
        ["contain", "Contain"],
        ["cover", "Cover"],
      ],
      this._state.fitMode,
    );
    this._fitModeSelect.addEventListener("change", () => {
      this._state.fitMode = this._fitModeSelect!.value as PrintFitMode;
    });
    row3.appendChild(this._makeField("Fit", this._fitModeSelect));

    this._pageBackgroundInput = document.createElement("input");
    this._pageBackgroundInput.type = "color";
    this._pageBackgroundInput.className = "print-input";
    this._pageBackgroundInput.value = this._toHexColor(
      this._state.pageBackground,
    );
    this._pageBackgroundInput.addEventListener("input", () => {
      this._state.pageBackground = this._pageBackgroundInput!.value;
    });
    row3.appendChild(this._makeField("Background", this._pageBackgroundInput));
    wrapper.appendChild(row3);

    this._updatePageOptionsDisabled();
    return wrapper;
  }

  /**
   * Disable page options that have no effect in the legacy 'fit' page mode.
   */
  private _updatePageOptionsDisabled(): void {
    const isFit = this._state.pageSize === "fit";
    if (this._orientationSelect) this._orientationSelect.disabled = isFit;
    if (this._fitModeSelect) this._fitModeSelect.disabled = isFit;
    if (this._marginInput) this._marginInput.disabled = isFit;
    if (this._pageBackgroundInput) this._pageBackgroundInput.disabled = isFit;
  }

  /**
   * Toggle quality field visibility based on format.
   */
  private _updateQualityVisibility(): void {
    if (this._qualityField) {
      this._qualityField.style.display =
        this._state.format === "jpeg" ? "" : "none";
    }
  }

  /**
   * Toggle copy button visibility (hidden for vector/document formats).
   */
  private _updateCopyBtnVisibility(): void {
    if (this._copyBtn) {
      const format = this._state.format;
      this._copyBtn.style.display =
        format === "pdf" || format === "svg" ? "none" : "";
    }
  }

  /**
   * Resolve the DPI used for physical sizing (PDF points, SVG inches, raster
   * metadata). Applies to every page mode — including `'fit'`, where the DPI
   * scales the export resolution — so viewers report the chosen density.
   *
   * @returns The effective dots-per-inch.
   */
  private _effectiveDpi(): number {
    return this._state.dpi > 0 ? this._state.dpi : 96;
  }

  /**
   * Export the canvas to a PDF file using jspdf. The composed canvas already
   * represents the full page (page size, margins, and overlays baked in), so
   * the PDF page is sized to match and the image fills it edge to edge.
   *
   * @param canvas - The composed export canvas.
   */
  private async _exportPdf(canvas: HTMLCanvasElement): Promise<void> {
    const { jsPDF } = await import("jspdf");
    const dpi = this._effectiveDpi();
    // Convert the page pixel dimensions to points (1 pt = 1/72 inch).
    const widthPt = (canvas.width / dpi) * 72;
    const heightPt = (canvas.height / dpi) * 72;

    // Pass the format in portrait order (short, long) and let the orientation
    // flag rotate it; jsPDF normalizes array formats, so we read the resolved
    // page size back rather than assuming the dimension order is preserved.
    const orientation = widthPt >= heightPt ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "pt",
      format: [Math.min(widthPt, heightPt), Math.max(widthPt, heightPt)],
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save(`${this._state.filename}.pdf`);
  }

  /**
   * Export the canvas to an SVG file. The rendered page is embedded as a
   * base64 PNG `<image>` sized to the page dimensions. A WebGL map cannot be
   * reconstructed as true vectors, so the map content remains raster.
   *
   * @param canvas - The composed export canvas.
   */
  private _exportSvg(canvas: HTMLCanvasElement): void {
    const pngDataUrl = canvas.toDataURL("image/png");
    const w = canvas.width;
    const h = canvas.height;
    // Express the SVG size in physical inches (with a pixel viewBox) so it
    // reports the correct page size, e.g. 11in x 8.5in for Letter landscape.
    const dpi = this._effectiveDpi();
    const widthIn = +(w / dpi).toFixed(4);
    const heightIn = +(h / dpi).toFixed(4);
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${widthIn}in" height="${heightIn}in" viewBox="0 0 ${w} ${h}">` +
      `<image width="${w}" height="${h}" xlink:href="${pngDataUrl}"/>` +
      `</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this._state.filename}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Compute a PNG/zlib CRC-32 over the given bytes.
   *
   * @param bytes - The bytes to checksum.
   * @returns The unsigned 32-bit CRC.
   */
  private _crc32(bytes: Uint8Array): number {
    let crc = ~0;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let k = 0; k < 8; k++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return ~crc >>> 0;
  }

  /**
   * Insert a `pHYs` chunk into a PNG so image viewers report the correct
   * physical (print) size. Canvas-generated PNGs carry no resolution metadata,
   * so without this a Letter page at 150 DPI is read as ~17x13 inches at 96 DPI.
   *
   * @param bytes - The original PNG bytes.
   * @param dpi - The target resolution in dots per inch.
   * @returns A new PNG byte array with the resolution embedded.
   */
  private _pngWithDpi(bytes: Uint8Array, dpi: number): Uint8Array {
    // The IHDR chunk always comes first: 8-byte signature + 4 (length) +
    // 4 (type) + 13 (data) + 4 (CRC) = byte offset 33.
    const insertAt = 33;
    if (bytes.length < insertAt) return bytes;

    // Pixels per metre (PNG pHYs unit 1 == metre). 1 inch = 0.0254 m.
    const ppm = Math.max(1, Math.round(dpi / 0.0254));

    const chunk = new Uint8Array(21); // 4 len + 4 type + 9 data + 4 CRC
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9); // data length
    chunk[4] = 0x70; // 'p'
    chunk[5] = 0x48; // 'H'
    chunk[6] = 0x59; // 'Y'
    chunk[7] = 0x73; // 's'
    view.setUint32(8, ppm); // X pixels per unit
    view.setUint32(12, ppm); // Y pixels per unit
    chunk[16] = 1; // unit specifier: metre
    view.setUint32(17, this._crc32(chunk.subarray(4, 17))); // CRC over type+data

    const out = new Uint8Array(bytes.length + chunk.length);
    out.set(bytes.subarray(0, insertAt), 0);
    out.set(chunk, insertAt);
    out.set(bytes.subarray(insertAt), insertAt + chunk.length);
    return out;
  }

  /**
   * Patch the JFIF APP0 density fields of a JPEG so it reports the correct DPI.
   *
   * @param bytes - The original JPEG bytes (mutated in place).
   * @param dpi - The target resolution in dots per inch.
   * @returns The same byte array with the density fields set when a JFIF
   *   header is present.
   */
  private _jpegWithDpi(bytes: Uint8Array, dpi: number): Uint8Array {
    // SOI (FFD8) followed by an APP0 (FFE0) "JFIF\0" segment.
    const hasJfif =
      bytes.length > 18 &&
      bytes[2] === 0xff &&
      bytes[3] === 0xe0 &&
      bytes[6] === 0x4a && // J
      bytes[7] === 0x46 && // F
      bytes[8] === 0x49 && // I
      bytes[9] === 0x46; // F
    if (!hasJfif) return bytes;

    const d = Math.max(1, Math.min(0xffff, Math.round(dpi)));
    bytes[13] = 1; // density units: dots per inch
    bytes[14] = (d >> 8) & 0xff; // X density (high)
    bytes[15] = d & 0xff; // X density (low)
    bytes[16] = (d >> 8) & 0xff; // Y density (high)
    bytes[17] = d & 0xff; // Y density (low)
    return bytes;
  }

  /**
   * Re-encode a raster blob with embedded DPI metadata.
   *
   * @param blob - The PNG or JPEG blob produced by the canvas.
   * @param format - The raster format.
   * @returns A new blob carrying the current DPI, or the original on failure.
   */
  private async _embedDpi(blob: Blob, format: "png" | "jpeg"): Promise<Blob> {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dpi = this._effectiveDpi();
      if (format === "png") {
        const out = this._pngWithDpi(bytes, dpi);
        return new Blob([out as unknown as BlobPart], { type: "image/png" });
      }
      const out = this._jpegWithDpi(bytes, dpi);
      return new Blob([out as unknown as BlobPart], { type: "image/jpeg" });
    } catch {
      return blob;
    }
  }

  /**
   * Read a blob as a base64 data URL.
   *
   * @param blob - The blob to encode.
   * @returns The data URL string.
   */
  private _blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image blob"));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Toggle custom size inputs visibility.
   */
  private _updateCustomSizeVisibility(): void {
    if (this._customSizeInputs) {
      this._customSizeInputs.style.display = this._sizeRadioCustom?.checked
        ? ""
        : "none";
    }
  }

  /**
   * Toggle colorbar settings visibility.
   */
  private _updateColorbarSettingsVisibility(): void {
    if (this._colorbarSettingsDiv) {
      this._colorbarSettingsDiv.style.display = this._state.colorbar.enabled
        ? ""
        : "none";
    }
  }

  /**
   * Get color stops from colormap configuration.
   */
  private _getColorStops(colormap: ColormapName | string[]): ColorStop[] {
    if (Array.isArray(colormap)) {
      return colormap.map((color, i) => ({
        position: i / (colormap.length - 1),
        color,
      }));
    }

    if (typeof colormap === "string" && isValidColormap(colormap)) {
      return getColormap(colormap);
    }

    return getColormap("viridis");
  }

  /**
   * Draw a colorbar on the export canvas.
   */
  private _drawColorbar(
    ctx: CanvasRenderingContext2D,
    content: Rect,
    titleBarHeight: number,
  ): void {
    const config = this._state.colorbar;
    const colormap = config.colormap ?? "viridis";
    const vmin = config.vmin ?? 0;
    const vmax = config.vmax ?? 1;
    const label = config.label ?? "";
    const units = config.units ?? "";
    const orientation = config.orientation ?? "vertical";
    const position = config.position ?? "bottom-right";
    const barThickness = config.barThickness ?? 20;
    const barLength = config.barLength ?? 150;
    const tickCount = config.tickCount ?? 5;

    const isVertical = orientation === "vertical";
    const padding = 16;
    const fontSize = 11;
    const labelFontSize = 12;
    const tickLength = 4;
    // Inner padding for horizontal colorbar to prevent tick labels from being clipped
    const horizontalInnerPadding = isVertical ? 0 : 24;

    // Calculate total dimensions
    const tickLabelWidth = 50;
    const totalWidth = isVertical
      ? barThickness +
        tickLength +
        tickLabelWidth +
        (label ? labelFontSize + 6 : 0)
      : barLength + horizontalInnerPadding * 2;
    const totalHeight = isVertical
      ? barLength + (label ? labelFontSize + 6 : 0)
      : barThickness +
        tickLength +
        fontSize +
        6 +
        (label ? labelFontSize + 6 : 0);

    // Determine position (relative to the content rect)
    let x: number, y: number;
    if (position.includes("left")) {
      x = content.x + padding;
    } else {
      x = content.x + content.w - totalWidth - padding;
    }
    if (position.includes("top")) {
      y = Math.max(content.y + padding, content.y + titleBarHeight + padding);
    } else {
      y = content.y + content.h - totalHeight - padding;
    }

    ctx.save();

    // Draw background
    const bgPadding = 8;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      x - bgPadding,
      y - bgPadding,
      totalWidth + bgPadding * 2,
      totalHeight + bgPadding * 2,
      4,
    );
    ctx.fill();
    ctx.stroke();

    // Draw label if provided
    let labelOffset = 0;
    if (label) {
      ctx.fillStyle = "#333";
      ctx.font = `600 ${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = isVertical ? "left" : "center";
      ctx.textBaseline = "top";
      if (isVertical) {
        ctx.fillText(label, x, y);
      } else {
        ctx.fillText(label, x + horizontalInnerPadding + barLength / 2, y);
      }
      labelOffset = labelFontSize + 6;
    }

    // Bar x offset for horizontal orientation
    const barX = isVertical ? x : x + horizontalInnerPadding;

    // Get color stops
    const stops = this._getColorStops(colormap);

    // Create gradient
    let gradient: CanvasGradient;
    if (isVertical) {
      // Vertical: gradient goes from bottom (vmin) to top (vmax)
      gradient = ctx.createLinearGradient(
        barX,
        y + labelOffset + barLength,
        barX,
        y + labelOffset,
      );
    } else {
      // Horizontal: gradient goes from left (vmin) to right (vmax)
      gradient = ctx.createLinearGradient(
        barX,
        y + labelOffset,
        barX + barLength,
        y + labelOffset,
      );
    }

    stops.forEach((stop) => {
      gradient.addColorStop(stop.position, stop.color);
    });

    // Draw gradient bar
    ctx.fillStyle = gradient;
    if (isVertical) {
      ctx.fillRect(barX, y + labelOffset, barThickness, barLength);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(barX, y + labelOffset, barThickness, barLength);
    } else {
      ctx.fillRect(barX, y + labelOffset, barLength, barThickness);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(barX, y + labelOffset, barLength, barThickness);
    }

    // Draw ticks and labels
    ctx.fillStyle = "#333";
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    for (let i = 0; i < tickCount; i++) {
      const ratio = i / (tickCount - 1);
      const value = vmin + ratio * (vmax - vmin);
      const formattedValue = this._formatTickValue(value, vmax - vmin);
      const labelText = units ? `${formattedValue}${units}` : formattedValue;

      if (isVertical) {
        // Vertical: ticks on the right side of the bar
        const tickY = y + labelOffset + barLength - ratio * barLength;
        ctx.beginPath();
        ctx.moveTo(barX + barThickness, tickY);
        ctx.lineTo(barX + barThickness + tickLength, tickY);
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, barX + barThickness + tickLength + 4, tickY);
      } else {
        // Horizontal: ticks below the bar
        const tickX = barX + ratio * barLength;
        ctx.beginPath();
        ctx.moveTo(tickX, y + labelOffset + barThickness);
        ctx.lineTo(tickX, y + labelOffset + barThickness + tickLength);
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(
          labelText,
          tickX,
          y + labelOffset + barThickness + tickLength + 2,
        );
      }
    }

    ctx.restore();
  }

  /**
   * Format a tick value for display.
   */
  private _formatTickValue(value: number, range: number): string {
    if (range === 0) return "0";

    const absValue = Math.abs(value);
    const absRange = Math.abs(range);

    // Determine precision based on range
    let decimals: number;
    if (absRange >= 100) {
      decimals = 0;
    } else if (absRange >= 10) {
      decimals = 1;
    } else if (absRange >= 1) {
      decimals = 2;
    } else if (absRange >= 0.1) {
      decimals = 3;
    } else {
      decimals = 4;
    }

    // Use scientific notation for very large or very small values
    if (absValue >= 1e6 || (absValue > 0 && absValue < 1e-4)) {
      return value.toExponential(2);
    }

    return value.toFixed(decimals);
  }

  /**
   * Expand the panel.
   */
  expand(): void {
    if (!this._state.collapsed) return;
    this._state.collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  /**
   * Collapse the panel.
   */
  collapse(): void {
    if (this._state.collapsed) return;
    this._state.collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  /**
   * Toggle the panel visibility.
   */
  private _togglePanel(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Show the panel.
   */
  private _showPanel(): void {
    if (!this._panel && this._container) {
      this._panel = this._createPanel();
      this._container.appendChild(this._panel);
    }
    this._button?.classList.add("active");
  }

  /**
   * Hide the panel.
   */
  private _hidePanel(): void {
    this._panel?.remove();
    this._panel = undefined;
    this._button?.classList.remove("active");
  }

  /**
   * Show feedback message.
   */
  private _showFeedback(message: string): void {
    if (!this._feedbackEl) return;
    this._feedbackEl.textContent = message;
    this._feedbackEl.classList.add("visible");
    setTimeout(() => {
      this._feedbackEl?.classList.remove("visible");
    }, 2000);
  }

  /**
   * Set loading state on buttons.
   */
  private _setExporting(exporting: boolean): void {
    this._state.exporting = exporting;
    if (this._exportBtn) {
      this._exportBtn.disabled = exporting;
    }
    if (this._copyBtn) {
      this._copyBtn.disabled = exporting;
    }
  }

  /**
   * Capture the map canvas during the render cycle.
   * WebGL canvases have preserveDrawingBuffer=false by default, so the
   * framebuffer is cleared after compositing. We must read it during render.
   */
  private _captureMapCanvas(): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      this._map!.once("render", () => {
        resolve(this._map!.getCanvas());
      });
      this._map!.triggerRepaint();
    });
  }

  /**
   * Draw a north arrow on the export canvas.
   */
  private _drawNorthArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    bearing: number,
  ): void {
    const half = size / 2;
    const tipMargin = size * 0.18;

    ctx.save();
    ctx.translate(x + half, y + half);
    // Keep north arrow aligned to true north when map is rotated.
    ctx.rotate((-bearing * Math.PI) / 180);

    // Arrow
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(0, -half + tipMargin);
    ctx.lineTo(size * 0.16, size * 0.12);
    ctx.lineTo(0, size * 0.02);
    ctx.lineTo(-size * 0.16, size * 0.12);
    ctx.closePath();
    ctx.fill();

    // N label
    ctx.fillStyle = "#111";
    ctx.font = `bold ${Math.round(size * 0.22)}px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, size * 0.3);

    ctx.restore();
  }

  /**
   * Return a rounded scale distance using 1/2/5 progression.
   */
  private _niceDistance(meters: number): number {
    if (meters <= 0) {
      return 0;
    }

    // Preserve sub-meter values using centimeter-based progression.
    if (meters < 1) {
      const centimeters = meters * 100;
      const exponent = Math.floor(Math.log10(Math.max(centimeters, 1)));
      const fraction = centimeters / 10 ** exponent;
      let niceFraction = 1;
      if (fraction >= 5) niceFraction = 5;
      else if (fraction >= 2) niceFraction = 2;
      return (niceFraction * 10 ** exponent) / 100;
    }

    const exponent = Math.floor(Math.log10(meters));
    const fraction = meters / 10 ** exponent;
    let niceFraction = 1;
    if (fraction >= 5) niceFraction = 5;
    else if (fraction >= 2) niceFraction = 2;
    return niceFraction * 10 ** exponent;
  }

  /**
   * Draw a scale bar on the export canvas.
   */
  private _drawScaleBar(
    ctx: CanvasRenderingContext2D,
    content: Rect,
    scaleX: number,
  ): void {
    if (!this._map) return;

    const center = this._map.getCenter();
    const zoom = this._map.getZoom();

    // Meters per pixel for Web Mercator at current latitude.
    const metersPerPixel =
      (156543.03392804097 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** zoom;
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return;

    // Export pixels per source map pixel (uniform draw scale).
    const pixelScale = scaleX;

    const targetBarPx = Math.max(80, Math.min(160, content.w * 0.16));
    const rawMeters = (targetBarPx / pixelScale) * metersPerPixel;
    const niceMeters = this._niceDistance(rawMeters);
    const barPx = Math.max(40, (niceMeters / metersPerPixel) * pixelScale);

    const padding = 18;
    const barHeight = 10;
    const minHeight = padding + barHeight + 28;
    if (content.h < minHeight) {
      return;
    }

    const x = content.x + padding;
    const y = content.y + content.h - padding - 24;

    ctx.save();

    // Background
    const bgW = barPx + 16;
    const bgH = barHeight + 28;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(x - 8, y - 8, bgW, bgH);
    ctx.fill();
    ctx.stroke();

    // Alternating black/white bar (2 segments)
    ctx.fillStyle = "#111";
    ctx.fillRect(x, y, barPx / 2, barHeight);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + barPx / 2, y, barPx / 2, barHeight);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barPx, barHeight);

    // Label
    const label =
      niceMeters >= 1000
        ? `${(niceMeters / 1000).toFixed(niceMeters % 1000 === 0 ? 0 : 1)} km`
        : niceMeters >= 1
          ? `${Math.round(niceMeters)} m`
          : `${Math.round(niceMeters * 100)} cm`;
    ctx.fillStyle = "#111";
    ctx.font =
      '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + barPx / 2, y + barHeight + 4);

    ctx.restore();
  }

  /**
   * Compute the export page layout (pixel dimensions, content rect, and the
   * destination rectangle the map is drawn into) for the current state.
   *
   * @param mapCanvas - The captured map canvas, used for the source aspect ratio.
   * @returns The resolved page layout.
   */
  private _getPageLayout(mapCanvas: HTMLCanvasElement): PageLayout {
    const mapW = mapCanvas.width;
    const mapH = mapCanvas.height;

    // 'fit' mode: the page is the current canvas (or Custom width/height), with
    // the map stretched to fill it. `dpi` acts as a resolution multiplier
    // relative to the 96 DPI baseline, so a higher DPI yields a larger,
    // higher-resolution export (the map is scaled up from the canvas, matching
    // the paper-preset behavior). The physical size stays the base size at
    // 96 DPI, so only the pixel count — and therefore the file size — grows.
    if (this._state.pageSize === "fit") {
      const baseW = this._state.width || mapW;
      const baseH = this._state.height || mapH;
      const dpi = this._state.dpi > 0 ? this._state.dpi : 96;
      const dpiScale = dpi / 96;
      const pageW = Math.max(1, Math.round(baseW * dpiScale));
      const pageH = Math.max(1, Math.round(baseH * dpiScale));
      return {
        pageW,
        pageH,
        content: { x: 0, y: 0, w: pageW, h: pageH },
        mapDest: { x: 0, y: 0, w: pageW, h: pageH },
        scaleX: mapW > 0 ? pageW / mapW : 1,
        clip: false,
        pageWidthIn: baseW / 96,
        pageHeightIn: baseH / 96,
      };
    }

    // Paper preset: resolve physical inches and orientation.
    const [portraitW, portraitH] = PAGE_SIZES_INCHES[this._state.pageSize];
    let orientation = this._state.orientation;
    if (orientation === "auto") {
      orientation = mapW >= mapH ? "landscape" : "portrait";
    }
    const pageWidthIn = orientation === "landscape" ? portraitH : portraitW;
    const pageHeightIn = orientation === "landscape" ? portraitW : portraitH;

    const dpi = this._state.dpi > 0 ? this._state.dpi : 96;
    const pageW = Math.max(1, Math.round(pageWidthIn * dpi));
    const pageH = Math.max(1, Math.round(pageHeightIn * dpi));

    const marginPx = Math.max(0, Math.round((this._state.margin / 72) * dpi));
    const contentX = marginPx;
    const contentY = marginPx;
    const contentW = Math.max(1, pageW - marginPx * 2);
    const contentH = Math.max(1, pageH - marginPx * 2);

    // Fit the map into the content rect.
    const containScale = Math.min(contentW / mapW, contentH / mapH);
    const coverScale = Math.max(contentW / mapW, contentH / mapH);
    const scale = this._state.fitMode === "cover" ? coverScale : containScale;
    const mapDestW = mapW * scale;
    const mapDestH = mapH * scale;

    return {
      pageW,
      pageH,
      content: { x: contentX, y: contentY, w: contentW, h: contentH },
      mapDest: {
        x: contentX + (contentW - mapDestW) / 2,
        y: contentY + (contentH - mapDestH) / 2,
        w: mapDestW,
        h: mapDestH,
      },
      scaleX: scale,
      clip: this._state.fitMode === "cover",
      pageWidthIn,
      pageHeightIn,
    };
  }

  /**
   * Create the export canvas from the map.
   */
  private async _createExportCanvas(): Promise<HTMLCanvasElement | null> {
    if (!this._map) return null;

    try {
      const mapCanvas = await this._captureMapCanvas();
      const layout = this._getPageLayout(mapCanvas);
      const { pageW, pageH, content, mapDest } = layout;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = pageW;
      exportCanvas.height = pageH;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return null;

      // Fill the page background (visible in margins and letterboxed areas).
      // Skipped in legacy 'fit' mode so transparent map pixels are preserved.
      if (this._state.pageSize !== "fit") {
        ctx.fillStyle = this._state.pageBackground;
        ctx.fillRect(0, 0, pageW, pageH);
      }

      // Draw the map, clipping to the content rect when cropping ('cover').
      ctx.save();
      if (layout.clip) {
        ctx.beginPath();
        ctx.rect(content.x, content.y, content.w, content.h);
        ctx.clip();
      }
      ctx.drawImage(mapCanvas, mapDest.x, mapDest.y, mapDest.w, mapDest.h);
      ctx.restore();

      // Draw title overlay if set (spans the content area).
      const title = this._state.title.trim();
      let titleBarHeight = 0;
      if (title) {
        const fontSize = this._options.titleFontSize;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const metrics = ctx.measureText(title);
        const textHeight = fontSize;
        const padding = fontSize * 0.6;
        titleBarHeight = textHeight + padding * 2;

        // Draw title background
        ctx.fillStyle = this._options.titleBackground;
        ctx.fillRect(content.x, content.y, content.w, titleBarHeight);

        // Draw title text
        ctx.fillStyle = this._options.titleFontColor;
        ctx.textBaseline = "middle";
        const x = content.x + (content.w - metrics.width) / 2;
        ctx.fillText(title, x, content.y + titleBarHeight / 2);
      }

      if (this._state.includeNorthArrow) {
        const arrowSize = Math.max(44, Math.min(72, content.w * 0.07));
        const minCanvasWidthForArrow = arrowSize + 18;

        if (content.w >= minCanvasWidthForArrow) {
          const arrowX = content.x + content.w - arrowSize - 18;
          const arrowY = Math.max(
            content.y + 18,
            content.y + titleBarHeight + 8,
          );
          const bearing = this._map.getBearing();
          this._drawNorthArrow(ctx, arrowX, arrowY, arrowSize, bearing);
        }
      }

      if (this._state.includeScaleBar) {
        this._drawScaleBar(ctx, content, layout.scaleX);
      }

      if (this._state.colorbar.enabled) {
        this._drawColorbar(ctx, content, titleBarHeight);
      }

      return exportCanvas;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to capture map canvas";
      this._emit("error", { error: errorMsg });
      return null;
    }
  }

  /**
   * Export the map to a file download.
   */
  private async _exportMap(): Promise<void> {
    if (this._state.exporting) return;
    this._setExporting(true);

    try {
      const canvas = await this._createExportCanvas();
      if (!canvas) {
        this._showFeedback("Export failed");
        this._setExporting(false);
        return;
      }

      if (this._state.format === "pdf") {
        await this._exportPdf(canvas);
        this._showFeedback("Exported!");
        this._emit("export");
      } else if (this._state.format === "svg") {
        this._exportSvg(canvas);
        this._showFeedback("Exported!");
        this._emit("export");
      } else {
        const mimeType =
          this._state.format === "jpeg" ? "image/jpeg" : "image/png";
        const quality =
          this._state.format === "jpeg" ? this._state.quality : undefined;
        const ext = this._state.format === "jpeg" ? "jpg" : "png";

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), mimeType, quality);
        });

        if (!blob) {
          this._showFeedback("Export failed");
          this._emit("error", { error: "Failed to create image blob" });
          this._setExporting(false);
          return;
        }

        // Embed DPI metadata so viewers report the correct physical page size.
        const outBlob = await this._embedDpi(
          blob,
          this._state.format === "jpeg" ? "jpeg" : "png",
        );

        // Trigger download
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this._state.filename}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Emit the same DPI-patched image that was downloaded.
        const dataUrl = await this._blobToDataUrl(outBlob);
        this._showFeedback("Exported!");
        this._emit("export", { dataUrl });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Export failed";
      this._showFeedback("Export failed");
      this._emit("error", { error: errorMsg });
    } finally {
      this._setExporting(false);
    }
  }

  /**
   * Copy the map to clipboard.
   */
  private async _copyToClipboard(): Promise<void> {
    if (this._state.exporting) return;
    this._setExporting(true);

    try {
      const canvas = await this._createExportCanvas();
      if (!canvas) {
        this._showFeedback("Copy failed");
        this._setExporting(false);
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) {
        this._showFeedback("Copy failed");
        this._emit("error", { error: "Failed to create image blob" });
        this._setExporting(false);
        return;
      }

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      const dataUrl = canvas.toDataURL("image/png");
      this._showFeedback("Copied!");
      this._emit("copy", { dataUrl });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Copy to clipboard failed";
      this._showFeedback("Copy failed");
      this._emit("error", { error: errorMsg });
    } finally {
      this._setExporting(false);
    }
  }

  /**
   * Set up zoom-based visibility handling.
   */
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

  // Public API methods

  /**
   * Show the control.
   */
  show(): this {
    this._state.visible = true;
    if (this._container && this._zoomVisible) {
      this._container.style.display = "";
    }
    this._emit("show");
    return this;
  }

  /**
   * Hide the control.
   */
  hide(): this {
    this._state.visible = false;
    if (this._container) {
      this._container.style.display = "none";
    }
    this._emit("hide");
    return this;
  }

  /**
   * Get the current state.
   */
  getState(): PrintControlState {
    return { ...this._state };
  }

  /**
   * Set the panel theme.
   *
   * Use `'light'` or `'dark'` to force a theme when the host application
   * manages its own light/dark mode, or `'auto'` to follow the system
   * `prefers-color-scheme`. Updates the live panel immediately.
   *
   * @param theme - The theme to apply.
   * @returns This control instance for chaining.
   */
  setTheme(theme: PrintTheme): this {
    this._options.theme = theme;
    if (this._container) {
      this._applyThemeClass(this._container);
    }
    return this;
  }

  /**
   * Apply the theme modifier class to the given element so the panel honors an
   * explicitly forced light/dark theme. `'auto'` removes both modifiers and
   * lets the CSS `prefers-color-scheme` media query drive the theme.
   */
  private _applyThemeClass(container: HTMLElement): void {
    container.classList.remove(
      "maplibre-gl-print-control--light",
      "maplibre-gl-print-control--dark",
    );
    if (this._options.theme === "light") {
      container.classList.add("maplibre-gl-print-control--light");
    } else if (this._options.theme === "dark") {
      container.classList.add("maplibre-gl-print-control--dark");
    }
  }

  /**
   * Set the export format.
   */
  setFormat(format: PrintFormat): this {
    this._state.format = format;
    if (this._formatSelect) {
      this._formatSelect.value = format;
    }
    this._updateQualityVisibility();
    this._updateCopyBtnVisibility();
    this._emit("update");
    return this;
  }

  /**
   * Set the JPEG quality.
   */
  setQuality(quality: number): this {
    this._state.quality = Math.max(0.1, Math.min(1, quality));
    if (this._qualityInput) {
      this._qualityInput.value = String(this._state.quality);
    }
    if (this._qualityValue) {
      this._qualityValue.textContent = this._state.quality.toFixed(2);
    }
    this._emit("update");
    return this;
  }

  /**
   * Set the title text.
   */
  setTitle(title: string): this {
    this._state.title = title;
    if (this._titleInput) {
      this._titleInput.value = title;
    }
    this._emit("update");
    return this;
  }

  /**
   * Export the map programmatically and return a data URL.
   */
  async exportMap(options?: {
    format?: PrintFormat;
    quality?: number;
    filename?: string;
    title?: string;
    includeNorthArrow?: boolean;
    includeScaleBar?: boolean;
    colorbar?: PrintColorbarConfig;
    width?: number;
    height?: number;
    pageSize?: PrintPageSize;
    orientation?: PrintOrientation;
    dpi?: number;
    margin?: number;
    pageBackground?: string;
    fitMode?: PrintFitMode;
  }): Promise<string> {
    // Apply temporary overrides
    const prevState = { ...this._state, colorbar: { ...this._state.colorbar } };
    if (options?.format) this._state.format = options.format;
    if (options?.quality) this._state.quality = options.quality;
    if (options?.filename) this._state.filename = options.filename;
    if (options?.title !== undefined) this._state.title = options.title;
    if (options?.includeNorthArrow !== undefined) {
      this._state.includeNorthArrow = options.includeNorthArrow;
    }
    if (options?.includeScaleBar !== undefined) {
      this._state.includeScaleBar = options.includeScaleBar;
    }
    if (options?.colorbar !== undefined) {
      this._state.colorbar = { ...this._state.colorbar, ...options.colorbar };
    }
    if (options?.width) this._state.width = options.width;
    if (options?.height) this._state.height = options.height;
    if (options?.pageSize) this._state.pageSize = options.pageSize;
    if (options?.orientation) this._state.orientation = options.orientation;
    if (options?.dpi) this._state.dpi = options.dpi;
    if (options?.margin !== undefined) this._state.margin = options.margin;
    if (options?.pageBackground !== undefined) {
      this._state.pageBackground = options.pageBackground;
    }
    if (options?.fitMode) this._state.fitMode = options.fitMode;

    try {
      const canvas = await this._createExportCanvas();
      if (!canvas) {
        throw new Error("Failed to capture map canvas");
      }

      if (this._state.format === "pdf") {
        await this._exportPdf(canvas);
        this._emit("export");
        return "";
      }

      if (this._state.format === "svg") {
        this._exportSvg(canvas);
        this._emit("export");
        return "";
      }

      const mimeType =
        this._state.format === "jpeg" ? "image/jpeg" : "image/png";
      const quality =
        this._state.format === "jpeg" ? this._state.quality : undefined;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mimeType, quality);
      });
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      const outBlob = await this._embedDpi(
        blob,
        this._state.format === "jpeg" ? "jpeg" : "png",
      );
      const dataUrl = await this._blobToDataUrl(outBlob);
      this._emit("export", { dataUrl });
      return dataUrl;
    } finally {
      // Restore state
      this._state.format = prevState.format;
      this._state.quality = prevState.quality;
      this._state.filename = prevState.filename;
      this._state.title = prevState.title;
      this._state.includeNorthArrow = prevState.includeNorthArrow;
      this._state.includeScaleBar = prevState.includeScaleBar;
      this._state.colorbar = prevState.colorbar;
      this._state.width = prevState.width;
      this._state.height = prevState.height;
      this._state.pageSize = prevState.pageSize;
      this._state.orientation = prevState.orientation;
      this._state.dpi = prevState.dpi;
      this._state.margin = prevState.margin;
      this._state.pageBackground = prevState.pageBackground;
      this._state.fitMode = prevState.fitMode;
    }
  }

  /**
   * Set the colorbar configuration.
   */
  setColorbar(config: PrintColorbarConfig): this {
    this._state.colorbar = { ...this._state.colorbar, ...config };
    // Update UI if panel is open
    if (this._colorbarInput) {
      this._colorbarInput.checked = this._state.colorbar.enabled ?? false;
    }
    if (
      this._colorbarColormapSelect &&
      typeof this._state.colorbar.colormap === "string"
    ) {
      this._colorbarColormapSelect.value = this._state.colorbar.colormap;
    }
    if (this._colorbarOrientationSelect) {
      this._colorbarOrientationSelect.value =
        this._state.colorbar.orientation ?? "vertical";
    }
    if (this._colorbarVminInput) {
      this._colorbarVminInput.value = String(this._state.colorbar.vmin ?? 0);
    }
    if (this._colorbarVmaxInput) {
      this._colorbarVmaxInput.value = String(this._state.colorbar.vmax ?? 1);
    }
    if (this._colorbarLabelInput) {
      this._colorbarLabelInput.value = this._state.colorbar.label ?? "";
    }
    if (this._colorbarUnitsInput) {
      this._colorbarUnitsInput.value = this._state.colorbar.units ?? "";
    }
    this._updateColorbarSettingsVisibility();
    this._emit("update");
    return this;
  }
}
