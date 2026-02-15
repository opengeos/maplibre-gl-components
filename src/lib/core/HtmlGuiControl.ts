import "../styles/common.css";
import "../styles/html-gui-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  HtmlGuiControlOptions,
  HtmlGuiControlState,
  HtmlGuiEvent,
  HtmlGuiEventHandler,
} from "./types";
import { HtmlControl } from "./HtmlControl";

/**
 * Default options for the HtmlGuiControl.
 */
const DEFAULT_OPTIONS: Required<HtmlGuiControlOptions> = {
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

/** SVG icon for the HTML control button. */
const CODE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

/** Close icon. */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * A GUI control for adding and configuring HTML content controls on the map.
 *
 * Provides a panel with a text area for HTML content, title, position
 * selection, and collapsibility options. The HTML control is added as a
 * separate control to the map.
 *
 * @example
 * ```typescript
 * const htmlGui = new HtmlGuiControl({ collapsed: true });
 * map.addControl(htmlGui, 'top-right');
 *
 * htmlGui.on('htmladd', (e) => {
 *   console.log('HTML control added:', e.state);
 * });
 * ```
 */
export class HtmlGuiControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<HtmlGuiControlOptions>;
  private _state: HtmlGuiControlState;
  private _eventHandlers: Map<HtmlGuiEvent, Set<HtmlGuiEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;

  // Active HTML control instance
  private _htmlControl?: HtmlControl;

  // DOM refs
  private _titleInput?: HTMLInputElement;
  private _htmlTextarea?: HTMLTextAreaElement;
  private _positionSelect?: HTMLSelectElement;
  private _collapsibleCheckbox?: HTMLInputElement;
  private _addBtn?: HTMLButtonElement;
  private _removeBtn?: HTMLButtonElement;
  private _previewEl?: HTMLElement;

  constructor(options?: HtmlGuiControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      title: "Info",
      html: '<div style="padding: 4px;">\n  <h4 style="margin: 0 0 8px 0;">Welcome</h4>\n  <p style="margin: 0; color: #666;">This is a custom HTML control.</p>\n</div>',
      htmlPosition: "top-left",
      collapsible: true,
      hasHtmlControl: false,
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
    this._removeHtmlControl();
    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  on(event: HtmlGuiEvent, handler: HtmlGuiEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  off(event: HtmlGuiEvent, handler: HtmlGuiEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(event: HtmlGuiEvent): void {
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

  getState(): HtmlGuiControlState {
    return { ...this._state };
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-html-gui-control ${this._options.className}`;
    if (!this._state.visible) {
      container.style.display = "none";
    }

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "html-gui-button";
    this._button.title = "HTML Control";
    this._button.innerHTML = CODE_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `html-gui-panel ${this._options.position.includes("left") ? "right" : "left"}`;
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
    header.className = "html-gui-header";
    header.innerHTML = `
      <span>HTML Control</span>
      <button type="button" class="html-gui-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".html-gui-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "html-gui-content";

    // Title
    const titleField = this._createField("Title");
    this._titleInput = document.createElement("input");
    this._titleInput.type = "text";
    this._titleInput.className = "html-gui-input";
    this._titleInput.placeholder = "Control title";
    this._titleInput.value = this._state.title;
    this._titleInput.addEventListener("input", () => {
      this._state.title = this._titleInput!.value;
      if (this._state.hasHtmlControl) this._updateHtmlControl();
    });
    titleField.appendChild(this._titleInput);
    content.appendChild(titleField);

    // HTML content textarea
    const htmlField = this._createField("HTML Content");
    this._htmlTextarea = document.createElement("textarea");
    this._htmlTextarea.className = "html-gui-textarea";
    this._htmlTextarea.rows = 6;
    this._htmlTextarea.value = this._state.html;
    this._htmlTextarea.placeholder = "<div>Your HTML here...</div>";
    this._htmlTextarea.addEventListener("input", () => {
      this._state.html = this._htmlTextarea!.value;
      this._updatePreviewContent();
      if (this._state.hasHtmlControl) this._updateHtmlControl();
    });
    htmlField.appendChild(this._htmlTextarea);
    content.appendChild(htmlField);

    // Preview
    const previewField = this._createField("Preview");
    this._previewEl = document.createElement("div");
    this._previewEl.className = "html-gui-preview";
    this._updatePreviewContent();
    previewField.appendChild(this._previewEl);
    content.appendChild(previewField);

    // Options row
    const optRow = document.createElement("div");
    optRow.className = "html-gui-row";

    const posField = this._createField("Position");
    this._positionSelect = document.createElement("select");
    this._positionSelect.className = "html-gui-select";
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
      opt.selected = p.value === this._state.htmlPosition;
      this._positionSelect!.appendChild(opt);
    });
    this._positionSelect.addEventListener("change", () => {
      this._state.htmlPosition =
        this._positionSelect!.value as ControlPosition;
      if (this._state.hasHtmlControl) {
        this._removeHtmlControl();
        this._addHtmlControl();
      }
    });
    posField.appendChild(this._positionSelect);
    optRow.appendChild(posField);

    const collapsibleField = this._createField("Options");
    const collapsibleLabel = document.createElement("label");
    collapsibleLabel.className = "html-gui-checkbox-label";
    this._collapsibleCheckbox = document.createElement("input");
    this._collapsibleCheckbox.type = "checkbox";
    this._collapsibleCheckbox.checked = this._state.collapsible;
    this._collapsibleCheckbox.addEventListener("change", () => {
      this._state.collapsible = !!this._collapsibleCheckbox?.checked;
      if (this._state.hasHtmlControl) {
        this._removeHtmlControl();
        this._addHtmlControl();
      }
    });
    collapsibleLabel.appendChild(this._collapsibleCheckbox);
    collapsibleLabel.appendChild(document.createTextNode(" Collapsible"));
    collapsibleField.appendChild(collapsibleLabel);
    optRow.appendChild(collapsibleField);
    content.appendChild(optRow);

    // Add/Update button
    this._addBtn = document.createElement("button");
    this._addBtn.type = "button";
    this._addBtn.className = "html-gui-add-btn";
    this._addBtn.textContent = this._state.hasHtmlControl
      ? "Update Control"
      : "Add HTML Control";
    this._addBtn.addEventListener("click", () => {
      if (this._state.hasHtmlControl) {
        this._updateHtmlControl();
      } else {
        this._addHtmlControl();
      }
    });
    content.appendChild(this._addBtn);

    // Remove button
    this._removeBtn = document.createElement("button");
    this._removeBtn.type = "button";
    this._removeBtn.className = "html-gui-remove-btn";
    this._removeBtn.textContent = "Remove Control";
    this._removeBtn.style.display = this._state.hasHtmlControl ? "" : "none";
    this._removeBtn.addEventListener("click", () => this._removeHtmlControl());
    content.appendChild(this._removeBtn);

    panel.appendChild(content);
    return panel;
  }

  private _createField(label: string): HTMLElement {
    const field = document.createElement("div");
    field.className = "html-gui-field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    field.appendChild(lbl);
    return field;
  }

  private _updatePreviewContent(): void {
    if (!this._previewEl) return;
    this._previewEl.innerHTML = this._state.html;
  }

  private _addHtmlControl(): void {
    if (!this._map) return;
    this._removeHtmlControl();
    this._htmlControl = new HtmlControl({
      title: this._state.title,
      html: this._state.html,
      collapsible: this._state.collapsible,
      collapsed: false,
    });
    this._map.addControl(this._htmlControl, this._state.htmlPosition);
    this._state.hasHtmlControl = true;
    this._updateButtonStates();
    this._emit("htmladd");
  }

  private _updateHtmlControl(): void {
    if (!this._htmlControl) return;
    this._htmlControl.update({
      title: this._state.title,
      html: this._state.html,
      collapsible: this._state.collapsible,
    });
    this._emit("htmlupdate");
  }

  private _removeHtmlControl(): void {
    if (this._htmlControl && this._map) {
      this._map.removeControl(this._htmlControl);
      this._htmlControl = undefined;
      this._state.hasHtmlControl = false;
      this._updateButtonStates();
      this._emit("htmlremove");
    }
  }

  private _updateButtonStates(): void {
    if (this._addBtn) {
      this._addBtn.textContent = this._state.hasHtmlControl
        ? "Update Control"
        : "Add HTML Control";
    }
    if (this._removeBtn) {
      this._removeBtn.style.display = this._state.hasHtmlControl ? "" : "none";
    }
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
   * Get the active HtmlControl instance (if any).
   */
  getHtmlControl(): HtmlControl | undefined {
    return this._htmlControl;
  }
}
