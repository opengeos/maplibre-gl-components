import "../styles/common.css";
import "../styles/time-slider-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  TimeSliderControlOptions,
  TimeSliderControlState,
  TimeSliderEvent,
  TimeSliderEventHandler,
  TimeSliderValue,
} from "./types";

/**
 * Convert a TimeSliderValue to a numeric value.
 */
function toNumeric(value: TimeSliderValue): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return value;
}

/**
 * Default options for the TimeSliderControl.
 */
const DEFAULT_OPTIONS: Required<
  Omit<
    TimeSliderControlOptions,
    | "value"
    | "values"
    | "formatLabel"
    | "backgroundColor"
    | "borderRadius"
    | "fontSize"
    | "fontColor"
  >
> & {
  value?: TimeSliderValue;
  values?: TimeSliderValue[];
  formatLabel?: (value: TimeSliderValue, index: number) => string;
  backgroundColor?: string;
  borderRadius?: number;
  fontSize?: number;
  fontColor?: string;
} = {
  position: "bottom-left",
  className: "",
  visible: true,
  collapsed: true,
  min: 0,
  max: 100,
  step: 1,
  fps: 1,
  loop: true,
  showPlayButton: true,
  showTimestamp: true,
  panelWidth: 300,
  minzoom: 0,
  maxzoom: 24,
};

/**
 * SVG icon for the clock toggle button.
 */
const CLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

/**
 * SVG icon for play.
 */
const PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

/**
 * SVG icon for pause.
 */
const PAUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

/**
 * SVG icon for close.
 */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * A control for scrubbing through temporal data with play/pause animation.
 *
 * @example
 * ```typescript
 * const slider = new TimeSliderControl({
 *   min: new Date('2024-01-01'),
 *   max: new Date('2024-12-31'),
 *   step: 86400000, // 1 day in ms
 *   fps: 2,
 *   loop: true,
 * });
 * map.addControl(slider, 'bottom-left');
 *
 * slider.on('change', (event) => {
 *   console.log('Current date:', event.value);
 * });
 * ```
 */
export class TimeSliderControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _playBtn?: HTMLButtonElement;
  private _rangeInput?: HTMLInputElement;
  private _valueLabel?: HTMLSpanElement;
  private _options: typeof DEFAULT_OPTIONS;
  private _state: TimeSliderControlState;
  private _eventHandlers: Map<TimeSliderEvent, Set<TimeSliderEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  private _intervalId?: ReturnType<typeof setInterval>;
  private _dateMode: boolean;
  private _numericMin: number;
  private _numericMax: number;
  private _numericStep: number;
  private _numericValues?: number[];

  constructor(options: TimeSliderControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._dateMode =
      this._options.min instanceof Date ||
      (typeof this._options.min === "string" &&
        isNaN(Number(this._options.min)));

    this._numericMin = toNumeric(this._options.min);
    this._numericMax = toNumeric(this._options.max);
    this._numericStep = this._options.step;

    if (this._options.values) {
      this._numericValues = this._options.values.map(toNumeric);
      this._numericMin = 0;
      this._numericMax = this._numericValues.length - 1;
      this._numericStep = 1;
    }

    const initialValue =
      this._options.value !== undefined
        ? this._numericValues
          ? this._numericValues.indexOf(toNumeric(this._options.value))
          : toNumeric(this._options.value)
        : this._numericMin;

    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      value: initialValue,
      playing: false,
      min: this._numericMin,
      max: this._numericMax,
    };
  }

  getDefaultPosition(): ControlPosition {
    return this._options.position;
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();

    this._handleZoom = () => this._checkZoomVisibility();
    this._map.on("zoom", this._handleZoom);

    if (!this._state.collapsed) {
      this._createPanel();
    }

    if (!this._state.visible) {
      this._container.style.display = "none";
    }

    return this._container;
  }

  onRemove(): void {
    this._pause();
    if (this._map && this._handleZoom) {
      this._map.off("zoom", this._handleZoom);
    }
    if (this._container?.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._playBtn = undefined;
    this._rangeInput = undefined;
    this._valueLabel = undefined;
    this._map = undefined;
  }

  /**
   * Register an event handler.
   */
  on(event: TimeSliderEvent, handler: TimeSliderEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: TimeSliderEvent, handler: TimeSliderEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  private _emit(
    event: TimeSliderEvent,
    extra?: { value?: TimeSliderValue; index?: number },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const payload = { type: event, state: this.getState(), ...extra };
      handlers.forEach((handler) => handler(payload));
    }
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.classList.add(
      "maplibregl-ctrl",
      "maplibre-gl-time-slider-control",
    );
    if (this._options.className) {
      container.classList.add(this._options.className);
    }

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "time-slider-button";
    this._button.title = "Toggle time slider";
    this._button.innerHTML = CLOCK_ICON;
    this._button.addEventListener("click", () => this.toggle());
    container.appendChild(this._button);

    return container;
  }

  private _createPanel(): void {
    if (!this._container) return;
    if (this._panel) return;

    this._panel = document.createElement("div");
    this._panel.className = "time-slider-panel";
    if (this._options.panelWidth) {
      this._panel.style.width = `${this._options.panelWidth}px`;
    }
    if (this._options.backgroundColor) {
      this._panel.style.backgroundColor = this._options.backgroundColor;
    }
    if (this._options.borderRadius !== undefined) {
      this._panel.style.borderRadius = `${this._options.borderRadius}px`;
    }

    // Header
    const header = document.createElement("div");
    header.className = "time-slider-header";

    const label = document.createElement("span");
    label.className = "time-slider-label";
    label.textContent = "Time Slider";
    header.appendChild(label);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "time-slider-close";
    closeBtn.title = "Close";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);

    this._panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "time-slider-content";

    // Play button
    if (this._options.showPlayButton) {
      this._playBtn = document.createElement("button");
      this._playBtn.type = "button";
      this._playBtn.className = "time-slider-play-btn";
      this._playBtn.title = "Play";
      this._playBtn.innerHTML = PLAY_ICON;
      this._playBtn.addEventListener("click", () => {
        if (this._state.playing) {
          this.pause();
        } else {
          this.play();
        }
      });
      content.appendChild(this._playBtn);
    }

    // Range slider
    this._rangeInput = document.createElement("input");
    this._rangeInput.type = "range";
    this._rangeInput.className = "time-slider-range";
    this._rangeInput.min = String(this._numericMin);
    this._rangeInput.max = String(this._numericMax);
    this._rangeInput.step = String(this._numericStep);
    this._rangeInput.value = String(this._state.value);
    this._rangeInput.addEventListener("input", () => {
      const val = Number(this._rangeInput!.value);
      this._setValueInternal(val);
    });
    content.appendChild(this._rangeInput);

    // Value label
    if (this._options.showTimestamp) {
      this._valueLabel = document.createElement("span");
      this._valueLabel.className = "time-slider-value";
      if (this._options.fontSize) {
        this._valueLabel.style.fontSize = `${this._options.fontSize}px`;
      }
      if (this._options.fontColor) {
        this._valueLabel.style.color = this._options.fontColor;
      }
      this._updateLabel();
      content.appendChild(this._valueLabel);
    }

    this._panel.appendChild(content);
    this._container.appendChild(this._panel);
  }

  private _removePanel(): void {
    this._pause();
    if (this._panel) {
      this._panel.remove();
      this._panel = undefined;
      this._playBtn = undefined;
      this._rangeInput = undefined;
      this._valueLabel = undefined;
    }
  }

  private _setValueInternal(numericValue: number): void {
    this._state.value = numericValue;
    if (this._rangeInput) {
      this._rangeInput.value = String(numericValue);
    }
    this._updateLabel();

    const { displayValue, index } = this._getDisplayValue(numericValue);
    this._emit("change", { value: displayValue, index });
  }

  private _getDisplayValue(numericValue: number): {
    displayValue: TimeSliderValue;
    index: number;
  } {
    if (this._numericValues) {
      const idx = Math.round(numericValue);
      const rawValues = this._options.values!;
      return { displayValue: rawValues[idx], index: idx };
    }
    if (this._dateMode) {
      return { displayValue: new Date(numericValue), index: -1 };
    }
    return { displayValue: numericValue, index: -1 };
  }

  private _updateLabel(): void {
    if (!this._valueLabel) return;

    const { displayValue, index } = this._getDisplayValue(this._state.value);

    if (this._options.formatLabel) {
      this._valueLabel.textContent = this._options.formatLabel(
        displayValue,
        index,
      );
    } else if (displayValue instanceof Date) {
      this._valueLabel.textContent = displayValue.toISOString().split("T")[0];
    } else {
      this._valueLabel.textContent = String(displayValue);
    }
  }

  private _play(): void {
    if (this._state.playing) return;
    this._state.playing = true;

    if (this._playBtn) {
      this._playBtn.innerHTML = PAUSE_ICON;
      this._playBtn.title = "Pause";
    }

    this._intervalId = setInterval(() => {
      let next = this._state.value + this._numericStep;
      if (next > this._numericMax) {
        if (this._options.loop) {
          next = this._numericMin;
        } else {
          this._pause();
          return;
        }
      }
      this._setValueInternal(next);
    }, 1000 / this._options.fps);

    this._emit("play");
  }

  private _pause(): void {
    if (!this._state.playing) return;
    this._state.playing = false;

    if (this._intervalId !== undefined) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }

    if (this._playBtn) {
      this._playBtn.innerHTML = PLAY_ICON;
      this._playBtn.title = "Play";
    }

    this._emit("pause");
  }

  private _checkZoomVisibility(): void {
    if (!this._map || !this._container) return;
    const zoom = this._map.getZoom();
    const wasVisible = this._zoomVisible;
    this._zoomVisible =
      zoom >= this._options.minzoom && zoom <= this._options.maxzoom;
    if (wasVisible !== this._zoomVisible) {
      this._container.style.display =
        this._zoomVisible && this._state.visible ? "" : "none";
    }
  }

  /**
   * Show the control.
   */
  show(): this {
    this._state.visible = true;
    if (this._container) {
      this._container.style.display = this._zoomVisible ? "" : "none";
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
   * Expand the panel.
   */
  expand(): this {
    if (!this._state.collapsed) return this;
    this._state.collapsed = false;
    this._createPanel();
    this._emit("expand");
    return this;
  }

  /**
   * Collapse the panel.
   */
  collapse(): this {
    if (this._state.collapsed) return this;
    this._state.collapsed = true;
    this._removePanel();
    this._emit("collapse");
    return this;
  }

  /**
   * Toggle the collapsed state.
   */
  toggle(): this {
    return this._state.collapsed ? this.expand() : this.collapse();
  }

  /**
   * Start playback.
   */
  play(): this {
    this._play();
    return this;
  }

  /**
   * Pause playback.
   */
  pause(): this {
    this._pause();
    return this;
  }

  /**
   * Set the current value.
   */
  setValue(value: TimeSliderValue): this {
    let numericValue: number;
    if (this._options.values) {
      // Look up index in the original values array
      const idx = this._options.values.findIndex((v) => {
        if (v instanceof Date && value instanceof Date) {
          return v.getTime() === value.getTime();
        }
        return v === value;
      });
      numericValue = idx >= 0 ? idx : toNumeric(value);
    } else {
      numericValue = toNumeric(value);
    }
    this._setValueInternal(
      Math.max(this._numericMin, Math.min(this._numericMax, numericValue)),
    );
    return this;
  }

  /**
   * Get the current display value.
   */
  getValue(): TimeSliderValue {
    return this._getDisplayValue(this._state.value).displayValue;
  }

  /**
   * Set the playback FPS.
   */
  setFps(fps: number): this {
    this._options.fps = fps;
    if (this._state.playing) {
      this._pause();
      this._play();
    }
    return this;
  }

  /**
   * Get the current state.
   */
  getState(): TimeSliderControlState {
    return { ...this._state };
  }
}
