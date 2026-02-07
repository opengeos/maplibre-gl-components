/**
 * Zarr Layer Adapter for integrating ZarrLayerControl with maplibre-gl-layer-control.
 *
 * This adapter implements the CustomLayerAdapter interface from maplibre-gl-layer-control,
 * allowing Zarr layers managed by ZarrLayerControl to appear in the layer control.
 */

import type { ZarrLayerControl } from "../core/ZarrLayer";
import type { CustomLayerAdapter, LayerState } from "./CogLayerAdapter";

/**
 * Internal layer info stored per Zarr layer.
 */
interface ZarrLayerInfo {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

/**
 * Adapter for Zarr layers.
 * Integrates ZarrLayerControl with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * const zarrControl = new ZarrLayerControl({ ... });
 * map.addControl(zarrControl, 'top-right');
 *
 * const zarrAdapter = new ZarrLayerAdapter(zarrControl);
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [zarrAdapter],
 * });
 * map.addControl(layerControl, 'top-right');
 * ```
 */
export class ZarrLayerAdapter implements CustomLayerAdapter {
  readonly type = "zarr";

  private zarrControl: ZarrLayerControl;
  private layerInfoMap: Map<string, ZarrLayerInfo> = new Map();
  private changeCallbacks: Array<
    (event: "add" | "remove", layerId: string) => void
  > = [];

  constructor(zarrControl: ZarrLayerControl) {
    this.zarrControl = zarrControl;

    // Listen for layer add/remove events from ZarrLayerControl
    this.zarrControl.on("layeradd", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        // Extract name from URL and variable
        let displayName = layerId;
        if (event.url) {
          try {
            const urlObj = new URL(event.url);
            const filename = urlObj.pathname.split("/").pop() || "";
            // Get variable from state
            const state = this.zarrControl.getState();
            const variable =
              state.layers.find((l) => l.id === layerId)?.variable || "";
            displayName = variable ? `${filename} / ${variable}` : filename;
          } catch {
            displayName = event.url;
          }
        }

        this.layerInfoMap.set(layerId, {
          id: layerId,
          name: displayName,
          visible: true,
          opacity: event.state?.layerOpacity ?? 1,
        });

        this.notifyLayerAdded(layerId);
      }
    });

    this.zarrControl.on("layerremove", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        this.layerInfoMap.delete(layerId);
        this.notifyLayerRemoved(layerId);
      }
    });

    // Initialize from existing layers in ZarrLayerControl state
    this.syncFromControlState();
  }

  /**
   * Sync adapter state from ZarrLayerControl's current state.
   * Called on initialization to pick up any existing layers.
   */
  private syncFromControlState(): void {
    const state = this.zarrControl.getState();
    if (state.layers && Array.isArray(state.layers)) {
      for (const layer of state.layers) {
        let displayName = layer.id;
        if (layer.url) {
          try {
            const urlObj = new URL(layer.url);
            const filename = urlObj.pathname.split("/").pop() || "";
            displayName = layer.variable
              ? `${filename} / ${layer.variable}`
              : filename;
          } catch {
            displayName = layer.url;
          }
        }

        this.layerInfoMap.set(layer.id, {
          id: layer.id,
          name: displayName,
          visible: true,
          opacity: layer.opacity ?? 1,
        });
      }
    }
  }

  /**
   * Get all Zarr layer IDs.
   */
  getLayerIds(): string[] {
    return Array.from(this.layerInfoMap.keys());
  }

  /**
   * Get the state of a Zarr layer.
   */
  getLayerState(layerId: string): LayerState | null {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return null;

    return {
      visible: info.visible,
      opacity: info.opacity,
      name: info.name,
    };
  }

  /**
   * Set visibility of a Zarr layer.
   */
  setVisibility(layerId: string, visible: boolean): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.visible = visible;

    // Use the public API to set visibility
    this.zarrControl.setLayerVisibility(layerId, visible, info.opacity);
  }

  /**
   * Set opacity of a Zarr layer.
   */
  setOpacity(layerId: string, opacity: number): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.opacity = opacity;

    // Only apply if layer is visible
    if (info.visible) {
      this.zarrControl.setLayerOpacity(layerId, opacity);
    }
  }

  /**
   * Get the display name for a Zarr layer.
   */
  getName(layerId: string): string {
    const info = this.layerInfoMap.get(layerId);
    return info?.name ?? layerId;
  }

  /**
   * Get the symbol type for Zarr layers.
   */
  getSymbolType(_layerId: string): string {
    return "raster";
  }

  /**
   * Remove a Zarr layer.
   */
  removeLayer(layerId: string): void {
    this.zarrControl.removeLayer(layerId);
  }

  /**
   * Notify that a layer was added.
   */
  private notifyLayerAdded(layerId: string): void {
    this.changeCallbacks.forEach((cb) => cb("add", layerId));
  }

  /**
   * Notify that a layer was removed.
   */
  private notifyLayerRemoved(layerId: string): void {
    this.changeCallbacks.forEach((cb) => cb("remove", layerId));
  }

  /**
   * Subscribe to layer changes.
   */
  onLayerChange(
    callback: (event: "add" | "remove", layerId: string) => void,
  ): () => void {
    this.changeCallbacks.push(callback);
    return () => {
      const idx = this.changeCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.changeCallbacks.splice(idx, 1);
      }
    };
  }
}
