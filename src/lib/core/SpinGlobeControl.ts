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
};

/**
 * SVG icon: globe with a circular rotation arrow.
 */
const SPIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"/><path d="M19 8l2.5 1.5L19 11"/></svg>`;

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
  private _button?: HTMLButtonElement;
  private _options: Required<SpinGlobeControlOptions>;
  private _spinning = false;
  /** True when paused due to user interaction (but _spinning remains true). */
  private _paused = false;
  private _animationId?: number;
  private _lastTime?: number;
  private _eventHandlers: Map<SpinGlobeEvent, Set<SpinGlobeEventHandler>> =
    new Map();

  // Bound handlers for interaction pause/resume
  private _onInteractionStart?: () => void;
  private _onInteractionEnd?: () => void;

  constructor(options?: SpinGlobeControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.title = "Spin globe";
    this._button.setAttribute("aria-label", "Spin globe");
    this._button.setAttribute("aria-pressed", "false");
    this._button.innerHTML = SPIN_ICON;
    this._button.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:29px;height:29px;cursor:pointer;";
    this._button.addEventListener("click", () => this.toggleSpin());

    this._container.appendChild(this._button);

    if (this._options.pauseOnInteraction) {
      this._onInteractionStart = () => this._pauseSpin();
      this._onInteractionEnd = () => this._resumeSpin();

      map.on("dragstart", this._onInteractionStart);
      map.on("touchstart", this._onInteractionStart);
      map.on("wheel", this._onInteractionStart);
      map.on("dragend", this._onInteractionEnd);
      map.on("touchend", this._onInteractionEnd);
    }

    if (this._options.spinOnLoad) {
      if (map.isStyleLoaded()) {
        this.startSpin();
      } else {
        map.once("load", () => this.startSpin());
      }
    }

    return this._container;
  }

  onRemove(): void {
    this.stopSpin();

    if (this._map) {
      if (this._onInteractionStart) {
        this._map.off("dragstart", this._onInteractionStart);
        this._map.off("touchstart", this._onInteractionStart);
        this._map.off("wheel", this._onInteractionStart);
      }
      if (this._onInteractionEnd) {
        this._map.off("dragend", this._onInteractionEnd);
        this._map.off("touchend", this._onInteractionEnd);
      }
    }

    this._container?.parentNode?.removeChild(this._container);
    this._map = undefined;
    this._container = undefined;
    this._button = undefined;
    this._eventHandlers.clear();
  }

  /**
   * Start spinning the globe.
   */
  startSpin(): void {
    if (this._spinning) return;
    this._spinning = true;
    this._paused = false;
    this._lastTime = undefined;
    this._animationId = requestAnimationFrame((t) => this._animate(t));
    this._updateButton();
    this._emit("spinstart");
  }

  /**
   * Stop spinning the globe.
   */
  stopSpin(): void {
    if (!this._spinning) return;
    this._spinning = false;
    this._paused = false;
    if (this._animationId !== undefined) {
      cancelAnimationFrame(this._animationId);
      this._animationId = undefined;
    }
    this._lastTime = undefined;
    this._updateButton();
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
   * Returns true if the globe is currently spinning (including when temporarily
   * paused due to user interaction).
   */
  isSpinning(): boolean {
    return this._spinning;
  }

  /**
   * Get the current control state.
   */
  getState(): SpinGlobeControlState {
    return { spinning: this._spinning };
  }

  /**
   * Update control options. Pass `speed` to change the rotation speed while running.
   */
  update(options: Partial<SpinGlobeControlOptions>): void {
    this._options = { ...this._options, ...options };
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

  private _pauseSpin(): void {
    if (!this._spinning || this._paused) return;
    this._paused = true;
    if (this._animationId !== undefined) {
      cancelAnimationFrame(this._animationId);
      this._animationId = undefined;
    }
    this._lastTime = undefined;
  }

  private _resumeSpin(): void {
    if (!this._spinning || !this._paused) return;
    this._paused = false;
    this._lastTime = undefined;
    this._animationId = requestAnimationFrame((t) => this._animate(t));
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
