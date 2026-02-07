/**
 * COG Layer Adapter for integrating CogLayerControl with maplibre-gl-layer-control.
 *
 * This adapter implements the CustomLayerAdapter interface from maplibre-gl-layer-control,
 * allowing COG layers managed by CogLayerControl to appear in the layer control.
 */

import type { CogLayerControl } from "../core/CogLayer";

/**
 * State for a layer managed by an adapter.
 */
export interface LayerState {
  /** Whether the layer is visible */
  visible: boolean;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Display name for the layer */
  name: string;
}

/**
 * Interface for custom layer adapters (matches maplibre-gl-layer-control's CustomLayerAdapter).
 */
export interface CustomLayerAdapter {
  /** Unique type identifier for this adapter (e.g., 'cog', 'zarr', 'deck') */
  type: string;
  /** Get all layer IDs managed by this adapter */
  getLayerIds(): string[];
  /** Get the current state of a layer */
  getLayerState(layerId: string): LayerState | null;
  /** Set layer visibility */
  setVisibility(layerId: string, visible: boolean): void;
  /** Set layer opacity (0-1) */
  setOpacity(layerId: string, opacity: number): void;
  /** Get display name for a layer */
  getName(layerId: string): string;
  /** Get layer symbol type for UI display (optional) */
  getSymbolType?(layerId: string): string;
  /**
   * Subscribe to layer changes (add/remove).
   * Returns an unsubscribe function.
   */
  onLayerChange?(
    callback: (event: "add" | "remove", layerId: string) => void,
  ): () => void;
  /**
   * Get the bounds of a layer (optional).
   * Returns [west, south, east, north] or null if not available.
   */
  getBounds?(layerId: string): [number, number, number, number] | null;
  /**
   * Remove a layer (optional).
   * Called when user removes a layer via context menu.
   */
  removeLayer?(layerId: string): void;
}

/**
 * Internal layer info stored per COG layer.
 */
interface CogLayerInfo {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  bounds?: [number, number, number, number];
}

/**
 * Adapter for COG (Cloud Optimized GeoTIFF) layers.
 * Integrates CogLayerControl with maplibre-gl-layer-control.
 *
 * @example
 * ```typescript
 * const cogControl = new CogLayerControl({ ... });
 * map.addControl(cogControl, 'top-right');
 *
 * const cogAdapter = new CogLayerAdapter(cogControl);
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [cogAdapter],
 * });
 * map.addControl(layerControl, 'top-right');
 * ```
 */
export class CogLayerAdapter implements CustomLayerAdapter {
  readonly type = "cog";

  private cogControl: CogLayerControl;
  private layerInfoMap: Map<string, CogLayerInfo> = new Map();
  private changeCallbacks: Array<
    (event: "add" | "remove", layerId: string) => void
  > = [];

  constructor(cogControl: CogLayerControl) {
    this.cogControl = cogControl;

    // Listen for layer add/remove events from CogLayerControl
    this.cogControl.on("layeradd", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        // Extract name from URL
        let displayName = layerId;
        if (event.url) {
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

    this.cogControl.on("layerremove", (event) => {
      const layerId = event.layerId;
      if (layerId) {
        this.layerInfoMap.delete(layerId);
        this.notifyLayerRemoved(layerId);
      }
    });

    // Initialize from existing layers in CogLayerControl state
    this.syncFromControlState();
  }

  /**
   * Sync adapter state from CogLayerControl's current state.
   * Called on initialization to pick up any existing layers.
   */
  private syncFromControlState(): void {
    const state = this.cogControl.getState();
    if (state.layers && Array.isArray(state.layers)) {
      for (const layer of state.layers) {
        let displayName = layer.id;
        if (layer.url) {
          try {
            const urlObj = new URL(layer.url);
            displayName = urlObj.pathname.split("/").pop() || layer.id;
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
   * Get all COG layer IDs.
   */
  getLayerIds(): string[] {
    return Array.from(this.layerInfoMap.keys());
  }

  /**
   * Get the state of a COG layer.
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
   * Set visibility of a COG layer.
   */
  setVisibility(layerId: string, visible: boolean): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.visible = visible;

    // Use the public API to set visibility
    this.cogControl.setLayerVisibility(layerId, visible, info.opacity);
  }

  /**
   * Set opacity of a COG layer.
   */
  setOpacity(layerId: string, opacity: number): void {
    const info = this.layerInfoMap.get(layerId);
    if (!info) return;

    info.opacity = opacity;

    // Only apply if layer is visible
    if (info.visible) {
      this.cogControl.setLayerOpacity(layerId, opacity);
    }
  }

  /**
   * Get the display name for a COG layer.
   */
  getName(layerId: string): string {
    const info = this.layerInfoMap.get(layerId);
    return info?.name ?? layerId;
  }

  /**
   * Get the symbol type for COG layers.
   */
  getSymbolType(_layerId: string): string {
    return "raster";
  }

  /**
   * Get the bounds of a COG layer (if available).
   */
  getBounds(layerId: string): [number, number, number, number] | null {
    const info = this.layerInfoMap.get(layerId);
    return info?.bounds ?? null;
  }

  /**
   * Remove a COG layer.
   */
  removeLayer(layerId: string): void {
    this.cogControl.removeLayer(layerId);
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
