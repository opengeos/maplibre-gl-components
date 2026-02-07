import type { CustomLayerAdapter, LayerState } from "./CogLayerAdapter";
import type { AddVectorControl } from "../core/AddVector";

/**
 * Options for the AddVectorAdapter.
 */
export interface AddVectorAdapterOptions {
  /** Display name in layer control. Default: 'Vector Layer'. */
  name?: string;
  /** Opacity to use when toggled on. Default: 1. */
  defaultOpacity?: number;
}

/**
 * Adapter to integrate AddVectorControl with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * const addVectorControl = new AddVectorControl({ collapsed: true });
 * const adapter = new AddVectorAdapter(addVectorControl, { name: 'My Vector Data' });
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [adapter],
 * });
 * ```
 */
export class AddVectorAdapter implements CustomLayerAdapter {
  readonly type = "addvector";

  private _control: AddVectorControl;
  private _options: AddVectorAdapterOptions;
  private _changeCallbacks: Array<(event: "add" | "remove", layerId: string) => void> = [];

  constructor(
    control: AddVectorControl,
    options?: AddVectorAdapterOptions,
  ) {
    this._control = control;
    this._options = options || {};

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
   * Get the underlying AddVectorControl instance.
   */
  getControl(): AddVectorControl {
    return this._control;
  }

  /**
   * Get all MapLibre layer IDs managed by this adapter.
   */
  getLayerIds(): string[] {
    return this._control.getLayerIds();
  }

  /**
   * Get the state of a vector layer.
   */
  getLayerState(layerId: string): LayerState | null {
    const visible = this._control.getLayerVisibility(layerId);
    const opacity = this._control.getLayerOpacity(layerId);

    if (opacity === null) return null;

    return {
      visible,
      opacity,
      name: this.getName(layerId),
    };
  }

  /**
   * Get display name for a layer.
   */
  getName(layerId: string): string {
    // Extract a readable name from the layer ID
    // Layer IDs are like: addvec-abc123-fill, addvec-abc123-line
    const parts = layerId.split("-");
    if (parts.length >= 3) {
      const type = parts[parts.length - 1];
      return `${this._options.name || "Vector"} (${type})`;
    }
    return this._options.name || layerId;
  }

  /**
   * Set visibility for a specific vector layer.
   */
  setVisibility(layerId: string, visible: boolean): void {
    this._control.setLayerVisibility(layerId, visible);
  }

  /**
   * Set opacity for a specific vector layer.
   */
  setOpacity(layerId: string, opacity: number): void {
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
   * Check if any vector layer is loaded.
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
        format: l.format,
        featureCount: l.featureCount,
        geometryTypes: l.geometryTypes,
      })),
    };
  }
}
