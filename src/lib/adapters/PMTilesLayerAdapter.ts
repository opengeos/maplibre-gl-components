import type { CustomLayerAdapter, LayerState } from "./CogLayerAdapter";
import type { PMTilesLayerControl } from "../core/PMTilesLayer";

/**
 * Options for the PMTilesLayerAdapter.
 */
export interface PMTilesLayerAdapterOptions {
  /** Display name in layer control. Default: 'PMTiles Layer'. */
  name?: string;
  /** Opacity to use when toggled on. Default: 1. */
  defaultOpacity?: number;
}

/**
 * Adapter to integrate PMTilesLayerControl with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * const pmtilesControl = new PMTilesLayerControl({ collapsed: true });
 * const adapter = new PMTilesLayerAdapter(pmtilesControl, { name: 'OSM PMTiles' });
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [adapter],
 * });
 * ```
 */
export class PMTilesLayerAdapter implements CustomLayerAdapter {
  readonly type = "pmtiles";

  private _control: PMTilesLayerControl;
  private _defaultOpacity: number;
  private _storedOpacity: number;
  private _changeCallbacks: Array<(event: "add" | "remove", layerId: string) => void> = [];

  constructor(
    control: PMTilesLayerControl,
    options?: PMTilesLayerAdapterOptions,
  ) {
    this._control = control;
    this._defaultOpacity = options?.defaultOpacity ?? 1;
    this._storedOpacity = this._defaultOpacity;
    // Note: options.name is for adapter identification, not used internally

    // Listen for layer changes
    this._control.on("layeradd", (event) => {
      if (event.layerId) {
        this._changeCallbacks.forEach((cb) => cb("add", event.layerId!));
      }
    });

    this._control.on("layerremove", (event) => {
      if (event.layerId) {
        this._changeCallbacks.forEach((cb) => cb("remove", event.layerId!));
      }
    });
  }

  /**
   * Get the underlying PMTilesLayerControl instance.
   */
  getControl(): PMTilesLayerControl {
    return this._control;
  }

  /**
   * Get all MapLibre layer IDs managed by this adapter.
   */
  getLayerIds(): string[] {
    return this._control.getLayerIds();
  }

  /**
   * Get the state of a PMTiles layer.
   */
  getLayerState(layerId: string): LayerState | null {
    const state = this._control.getState();
    const layer = state.layers.find((l) => l.id === layerId);
    if (!layer) return null;

    return {
      visible: this._control.getLayerVisibility(layerId),
      opacity: layer.opacity ?? this._storedOpacity,
      name: this.getName(layerId),
    };
  }

  /**
   * Get display name for a layer.
   */
  getName(layerId: string): string {
    const state = this._control.getState();
    const layer = state.layers.find((l) => l.id === layerId);
    if (!layer) return layerId;

    try {
      const urlObj = new URL(layer.url);
      return urlObj.pathname.split("/").pop() || layerId;
    } catch {
      return layer.url || layerId;
    }
  }

  /**
   * Set visibility for a specific PMTiles layer.
   */
  setVisibility(layerId: string, visible: boolean): void {
    this._control.setLayerVisibility(layerId, visible);
  }

  /**
   * Set opacity for a specific PMTiles layer.
   */
  setOpacity(layerId: string, opacity: number): void {
    this._storedOpacity = opacity;
    this._control.setLayerOpacity(layerId, opacity);
  }

  /**
   * Subscribe to layer changes.
   */
  onLayerChange(callback: (event: "add" | "remove", layerId: string) => void): () => void {
    this._changeCallbacks.push(callback);
    return () => {
      const idx = this._changeCallbacks.indexOf(callback);
      if (idx >= 0) this._changeCallbacks.splice(idx, 1);
    };
  }

  /**
   * Check if any PMTiles layer is loaded.
   */
  hasLayers(): boolean {
    return this._control.getState().hasLayer;
  }

  /**
   * Get metadata about the adapter.
   */
  getMetadata(): Record<string, unknown> {
    const state = this._control.getState();
    return {
      layerCount: state.layerCount,
      layers: state.layers.map((l) => ({
        id: l.id,
        url: l.url,
        tileType: l.tileType,
        sourceLayers: l.sourceLayers,
      })),
    };
  }
}
