/**
 * STAC Layer Adapter for integrating StacLayerControl with maplibre-gl-layer-control.
 *
 * This adapter implements the CustomLayerAdapter interface from maplibre-gl-layer-control,
 * allowing STAC layers managed by StacLayerControl to appear in the layer control.
 */

import type { StacLayerControl } from "../core/StacLayer";
import type { CustomLayerAdapter, LayerState } from "./CogLayerAdapter";

/**
 * Internal layer info stored per STAC layer.
 */
interface StacLayerInfo {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

/**
 * Adapter for STAC layers.
 * Integrates StacLayerControl with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * const stacControl = new StacLayerControl({ ... });
 * map.addControl(stacControl, 'top-right');
 *
 * const stacAdapter = new StacLayerAdapter(stacControl);
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [stacAdapter],
 * });
 * map.addControl(layerControl, 'top-right');
 * ```
 */
export class StacLayerAdapter implements CustomLayerAdapter {
  readonly type = "stac";

  private stacControl: StacLayerControl;
  private layerInfoMap: Map<string, StacLayerInfo> = new Map();
  private changeCallbacks: Array<
    (event: "add" | "remove", layerId: string) => void
  > = [];

  constructor(stacControl: StacLayerControl) {
    this.stacControl = stacControl;

    // Listen for layer add/remove events from StacLayerControl
    this.stacControl.on("layeradd", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        let displayName = layerId;
        if (event.assetKey) {
          displayName = `STAC: ${event.assetKey}`;
        } else if (event.url) {
          try {
            const urlObj = new URL(event.url);
            displayName = urlObj.pathname.split("/").pop() || layerId;
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

    this.stacControl.on("layerremove", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        this.layerInfoMap.delete(layerId);
        this.notifyLayerRemoved(layerId);
      }
    });

    // Initialize from existing layers
    this.syncFromControlState();
  }

  /**
   * Sync adapter state from StacLayerControl's current state.
   */
  private syncFromControlState(): void {
    const layerIds = this.stacControl.getLayerIds();
    for (const id of layerIds) {
      const opacity = this.stacControl.getLayerOpacity(id);
      this.layerInfoMap.set(id, {
        id,
        name: id,
        visible: opacity !== null && opacity > 0,
        opacity: opacity ?? 1,
      });
    }
  }

  /**
   * Get all STAC layer IDs.
   */
  getLayerIds(): string[] {
    return Array.from(this.layerInfoMap.keys());
  }

  /**
   * Get the state of a STAC layer.
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
   * Set visibility of a STAC layer.
   */
  setVisibility(layerId: string, visible: boolean): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.visible = visible;
    this.stacControl.setLayerVisibility(layerId, visible, info.opacity);
  }

  /**
   * Set opacity of a STAC layer.
   */
  setOpacity(layerId: string, opacity: number): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.opacity = opacity;
    if (info.visible) {
      this.stacControl.setLayerOpacity(layerId, opacity);
    }
  }

  /**
   * Get the display name for a STAC layer.
   */
  getName(layerId: string): string {
    const info = this.layerInfoMap.get(layerId);
    return info?.name ?? layerId;
  }

  /**
   * Get the symbol type for STAC layers.
   */
  getSymbolType(_layerId: string): string {
    return "raster";
  }

  /**
   * Remove a STAC layer.
   */
  removeLayer(layerId: string): void {
    this.stacControl.removeLayer(layerId);
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
