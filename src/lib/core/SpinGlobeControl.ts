import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type {
  SpinGlobeControlOptions,
  SpinGlobeControlState,
  SpinGlobeEvent,
  SpinGlobeEventData,
  SpinGlobeEventHandler,
} from "./types";

/**
 * Default options for the SpinGlobeControl.
 */
const DEFAULT_OPTIONS: Required<SpinGlobeControlOptions> = {
  speed: 10,
  spinOnLoad: false,
  pauseOnInteraction: true,
  collapsed: true,
};

const INTERACTION_START_EVENTS = [
  "dragstart",
  "zoomstart",
  "rotatestart",
  "pitchstart",
  "boxzoomstart",
  "touchstart",
] as const;

/**
 * SVG icon: circular arrow (refresh/rotate) to represent globe spinning.
 */
const SPIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.636-6.364"/><polyline points="21 3 21 9 15 9"/></svg>`;

/**
 * A control that spins the globe by continuously shifting the map center longitude.
 *
 * Works in both globe and flat map projections. In globe projection the effect
 * resembles a physical globe spinning on its axis.
 *
 * @example
 * ```typescript
 * const spinControl = new SpinGlobeControl({ speed: 15, spinOnLoad: true });
 * map.addControl(spinControl, 'top-right');
 *
 * spinControl.on('spinstart', () => console.log('spinning'));
 * spinControl.on('spinstop', () => console.log('stopped'));
 * ```
 */
export class SpinGlobeControl implements IControl {
  private _map?: MapLibreMap;
  private _container?: HTMLElement;
  _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<SpinGlobeControlOptions>;
  private _spinning = false;
  private _collapsed: boolean;
  private _animationId?: number;
  private _lastTime?: number;
  private _eventHandlers: Map<SpinGlobeEvent, Set<SpinGlobeEventHandler>> =
    new Map();

  // DOM refs for the panel
  private _speedInput?: HTMLInputElement;
  private _speedValueEl?: HTMLElement;
  private _toggleBtn?: HTMLButtonElement;

  // Bound handler for stopping spin when the map receives direct user input.
  private _onInteractionStart?: () => void;
  private _onDoubleClick?: () => void;
  private _wheelTarget?: HTMLElement;
  private _doubleClickTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(options?: SpinGlobeControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._collapsed = this._options.collapsed;
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className =
      "maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-spin-globe-control";

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.title = "Spin globe";
    this._button.setAttribute("aria-label", "Spin globe");
    this._button.setAttribute("aria-pressed", "false");
    this._button.innerHTML = SPIN_ICON;
    this._button.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:29px;height:29px;cursor:pointer;";
    this._button.addEventListener("click", () => this._togglePanel());

    this._container.appendChild(this._button);

    this._onDoubleClick = () => this._startSpinAfterDoubleClick();
    map.on("dblclick", this._onDoubleClick);

    if (this._options.pauseOnInteraction) {
      this._onInteractionStart = () => this._stopSpinForInteraction();

      INTERACTION_START_EVENTS.forEach((eventName) => {
        map.on(eventName, this._onInteractionStart!);
      });

      const canvas = map.getCanvas?.();
      if (canvas?.addEventListener) {
        this._wheelTarget = canvas;
        canvas.addEventListener("wheel", this._onInteractionStart, {
          passive: true,
        });
      }
    }

    if (this._options.spinOnLoad) {
      if (map.isStyleLoaded()) {
        this.startSpin();
      } else {
        map.once("load", () => this.startSpin());
      }
    }

    if (!this._collapsed) {
      this._showPanel();
    }

    return this._container;
  }

  onRemove(): void {
    this.stopSpin();

    if (this._doubleClickTimeoutId !== undefined) {
      clearTimeout(this._doubleClickTimeoutId);
      this._doubleClickTimeoutId = undefined;
    }

    if (this._map) {
      if (this._onInteractionStart) {
        INTERACTION_START_EVENTS.forEach((eventName) => {
          this._map!.off(eventName, this._onInteractionStart!);
        });
      }
      if (this._onDoubleClick) {
        this._map.off("dblclick", this._onDoubleClick);
      }
    }
    if (this._wheelTarget && this._onInteractionStart) {
      this._wheelTarget.removeEventListener("wheel", this._onInteractionStart);
    }

    this._container?.parentNode?.removeChild(this._container);
    this._map = undefined;
    this._container = undefined;
    this._button = undefined;
    this._panel = undefined;
    this._speedInput = undefined;
    this._speedValueEl = undefined;
    this._toggleBtn = undefined;
    this._onInteractionStart = undefined;
    this._onDoubleClick = undefined;
    this._wheelTarget = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Start spinning the globe.
   */
  startSpin(): void {
    if (this._spinning) return;
    this._spinning = true;
    this._lastTime = undefined;
    this._animationId = requestAnimationFrame((t) => this._animate(t));
    this._updateButton();
    this._updateToggleBtn();
    this._emit("spinstart");
  }

  /**
   * Stop spinning the globe.
   */
  stopSpin(): void {
    if (!this._spinning) return;
    this._spinning = false;
    if (this._animationId !== undefined) {
      cancelAnimationFrame(this._animationId);
      this._animationId = undefined;
    }
    this._lastTime = undefined;
    this._updateButton();
    this._updateToggleBtn();
    this._emit("spinstop");
  }

  /**
   * Toggle between spinning and stopped.
   */
  toggleSpin(): void {
    if (this._spinning) {
      this.stopSpin();
    } else {
      this.startSpin();
    }
  }

  /**
   * Returns true if the globe is currently spinning.
   */
  isSpinning(): boolean {
    return this._spinning;
  }

  /**
   * Get the current control state.
   */
  getState(): SpinGlobeControlState {
    return { spinning: this._spinning, collapsed: this._collapsed };
  }

  /**
   * Update control options. Pass `speed` to change the rotation speed while running.
   */
  update(options: Partial<SpinGlobeControlOptions>): void {
    this._options = { ...this._options, ...options };
    if (options.speed !== undefined && this._speedInput) {
      this._speedInput.value = String(options.speed);
      if (this._speedValueEl) {
        this._speedValueEl.textContent = `${options.speed}`;
      }
    }
  }

  /**
   * Expand the settings panel.
   */
  expand(): void {
    if (!this._collapsed) return;
    this._collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  /**
   * Collapse the settings panel.
   */
  collapse(): void {
    if (this._collapsed) return;
    this._collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  /**
   * Register an event handler.
   */
  on(event: SpinGlobeEvent, handler: SpinGlobeEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler.
   */
  off(event: SpinGlobeEvent, handler: SpinGlobeEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private _togglePanel(): void {
    if (this._collapsed) {
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
    this._speedInput = undefined;
    this._speedValueEl = undefined;
    this._toggleBtn = undefined;
    this._button?.classList.remove("active");
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "spin-globe-panel";
    panel.style.cssText =
      "position:absolute;top:0;right:calc(100% + 0px);background:#fff;color:#000;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:12px;z-index:1;white-space:nowrap;min-width:180px;";

    // Header
    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600;font-size:13px;color:#000;";
    header.textContent = "Spin Globe";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00d7";
    closeBtn.style.cssText =
      "background:none;border:none;font-size:18px;cursor:pointer;color:#000;padding:0 0 0 8px;line-height:1;";
    closeBtn.addEventListener("click", () => this.collapse());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Speed slider
    const speedRow = document.createElement("div");
    speedRow.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12px;color:#000;";

    const speedLabel = document.createElement("label");
    speedLabel.textContent = "Speed";
    speedLabel.style.cssText = "flex-shrink:0;font-weight:500;";

    this._speedInput = document.createElement("input");
    this._speedInput.type = "range";
    this._speedInput.min = "1";
    this._speedInput.max = "60";
    this._speedInput.step = "1";
    this._speedInput.value = String(this._options.speed);
    this._speedInput.style.cssText =
      "flex:1;min-width:80px;cursor:pointer;accent-color:#2563eb;";

    this._speedValueEl = document.createElement("span");
    this._speedValueEl.textContent = `${this._options.speed}`;
    this._speedValueEl.style.cssText =
      "min-width:20px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;";

    const unitLabel = document.createElement("span");
    unitLabel.textContent = "\u00b0/s";
    unitLabel.style.cssText = "flex-shrink:0;color:#000;";

    this._speedInput.addEventListener("input", () => {
      const speed = Number(this._speedInput!.value);
      this._options.speed = speed;
      if (this._speedValueEl) {
        this._speedValueEl.textContent = `${speed}`;
      }
    });

    speedRow.appendChild(speedLabel);
    speedRow.appendChild(this._speedInput);
    speedRow.appendChild(this._speedValueEl);
    speedRow.appendChild(unitLabel);
    panel.appendChild(speedRow);

    // Start/Stop button
    this._toggleBtn = document.createElement("button");
    this._toggleBtn.type = "button";
    this._updateToggleBtn();
    this._toggleBtn.style.cssText =
      "width:100%;padding:6px 0;border:1px solid #333;border-radius:4px;background:#fff;font-size:12px;font-weight:500;color:#000;cursor:pointer;";
    this._toggleBtn.addEventListener("mouseenter", () => {
      if (this._toggleBtn)
        this._toggleBtn.style.backgroundColor = "#f0f0f0";
    });
    this._toggleBtn.addEventListener("mouseleave", () => {
      if (this._toggleBtn) this._toggleBtn.style.backgroundColor = "#fff";
    });
    this._toggleBtn.addEventListener("click", () => this.toggleSpin());
    panel.appendChild(this._toggleBtn);

    return panel;
  }

  private _updateToggleBtn(): void {
    if (!this._toggleBtn) return;
    this._toggleBtn.textContent = this._spinning ? "Stop" : "Start";
  }

  private _animate(time: number): void {
    if (!this._spinning || !this._map) return;

    if (this._lastTime !== undefined) {
      const delta = (time - this._lastTime) / 1000; // seconds
      const center = this._map.getCenter();
      center.lng -= this._options.speed * delta;
      this._map.jumpTo({ center });
    }

    this._lastTime = time;
    this._animationId = requestAnimationFrame((t) => this._animate(t));
  }

  private _stopSpinForInteraction(): void {
    if (!this._spinning) return;
    this.stopSpin();
  }

  private _startSpinAfterDoubleClick(): void {
    if (this._doubleClickTimeoutId !== undefined) {
      clearTimeout(this._doubleClickTimeoutId);
    }
    this._doubleClickTimeoutId = setTimeout(() => {
      this._doubleClickTimeoutId = undefined;
      if (!this._map) return;
      this.startSpin();
    }, 0);
  }

  private _updateButton(): void {
    if (!this._button) return;
    if (this._spinning) {
      this._button.style.backgroundColor = "rgba(0, 120, 215, 0.15)";
      this._button.title = "Stop globe spin";
      this._button.setAttribute("aria-label", "Stop globe spin");
      this._button.setAttribute("aria-pressed", "true");
    } else {
      this._button.style.backgroundColor = "";
      this._button.title = "Spin globe";
      this._button.setAttribute("aria-label", "Spin globe");
      this._button.setAttribute("aria-pressed", "false");
    }
  }

  private _emit(event: SpinGlobeEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (!handlers) return;
    const data: SpinGlobeEventData = { type: event, state: this.getState() };
    handlers.forEach((handler) => handler(data));
  }
}
