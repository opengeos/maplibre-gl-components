import type { CustomLayerAdapter, LayerState } from "./CogLayerAdapter";
import type { PMTilesLayerControl } from "../core/PMTilesLayer";

/**
 * Internal group info: one group per source layer (e.g., "boundaries").
 * Each group bundles fill, line, and circle sub-layers.
 */
interface SourceLayerGroup {
  /** Display name (e.g., "Boundaries") */
  name: string;
  /** All MapLibre sub-layer IDs in this group */
  sublayers: string[];
  /** Whether the group is visible */
  visible: boolean;
  /** Group opacity */
  opacity: number;
}

/**
 * Adapter to integrate PMTilesLayerControl with maplibre-gl-layer-control.
 *
 * Layers are grouped by source layer — e.g. the fill, line, and circle
 * sub-layers for "boundaries" appear as a single "Boundaries" entry.
 * Toggling visibility or changing opacity affects all sub-layers in the group.
 *
 * @example
 * ```typescript
 * const pmtilesControl = new PMTilesLayerControl({ collapsed: true });
 * const adapter = new PMTilesLayerAdapter(pmtilesControl);
 *
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [adapter],
 * });
 * ```
 */
export class PMTilesLayerAdapter implements CustomLayerAdapter {
  readonly type = "pmtiles";

  private _control: PMTilesLayerControl;
  private _groups: Map<string, SourceLayerGroup> = new Map();
  private _changeCallbacks: Array<
    (event: "add" | "remove", layerId: string) => void
  > = [];

  constructor(control: PMTilesLayerControl) {
    this._control = control;

    // Listen for source add/remove events and rebuild groups
    this._control.on("layeradd", () => {
      // Small delay to let the control finish setting up layers
      setTimeout(() => this._rebuildGroups(), 50);
    });

    this._control.on("layerremove", () => {
      setTimeout(() => this._rebuildGroups(), 50);
    });
  }

  /**
   * Rebuild source-layer groups from the current control state.
   * Emits add/remove events for any groups that changed.
   */
  private _rebuildGroups(): void {
    const oldGroupIds = new Set(this._groups.keys());
    const newGroups = new Map<string, SourceLayerGroup>();

    for (const layerInfo of this._control.getState().layers) {
      const sourceId = layerInfo.id; // e.g., "pmtiles-source-0"

      if (layerInfo.sourceLayers && layerInfo.sourceLayers.length > 0) {
        // Vector tiles — group by source layer
        for (const sourceLayer of layerInfo.sourceLayers) {
          const groupId = `${sourceId}-${sourceLayer}`;
          const prefix = `${sourceId}-${sourceLayer}-`;
          const sublayers = layerInfo.layerIds.filter((id) =>
            id.startsWith(prefix),
          );
          if (sublayers.length > 0) {
            newGroups.set(groupId, {
              name:
                sourceLayer.charAt(0).toUpperCase() + sourceLayer.slice(1),
              sublayers,
              visible: true,
              opacity: layerInfo.opacity,
            });
          }
        }
      } else {
        // Raster or generic — single entry per source
        const name = this._extractFilename(layerInfo.url);
        newGroups.set(sourceId, {
          name,
          sublayers: [...layerInfo.layerIds],
          visible: true,
          opacity: layerInfo.opacity,
        });
      }
    }

    // Notify about added groups
    for (const groupId of newGroups.keys()) {
      if (!oldGroupIds.has(groupId)) {
        this._changeCallbacks.forEach((cb) => cb("add", groupId));
      }
    }
    // Notify about removed groups
    for (const groupId of oldGroupIds) {
      if (!newGroups.has(groupId)) {
        this._changeCallbacks.forEach((cb) => cb("remove", groupId));
      }
    }

    this._groups = newGroups;
  }

  /**
   * Extract a readable filename from a URL.
   */
  private _extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split("/").pop() || url;
    } catch {
      return url;
    }
  }

  /**
   * Get all group IDs (one per source layer).
   */
  getLayerIds(): string[] {
    return Array.from(this._groups.keys());
  }

  /**
   * Get the state of a source-layer group.
   */
  getLayerState(layerId: string): LayerState | null {
    const group = this._groups.get(layerId);
    if (!group) return null;

    return {
      visible: group.visible,
      opacity: group.opacity,
      name: group.name,
    };
  }

  /**
   * Get display name for a source-layer group.
   */
  getName(layerId: string): string {
    return this._groups.get(layerId)?.name ?? layerId;
  }

  /**
   * Get the symbol type for PMTiles layer groups.
   */
  getSymbolType(_layerId: string): string {
    return "fill";
  }

  /**
   * Set visibility for all sub-layers in a group.
   */
  setVisibility(layerId: string, visible: boolean): void {
    const group = this._groups.get(layerId);
    if (!group) return;

    group.visible = visible;
    for (const sublayer of group.sublayers) {
      this._control.setLayerVisibility(sublayer, visible);
    }
  }

  /**
   * Set opacity for all sub-layers in a group.
   */
  setOpacity(layerId: string, opacity: number): void {
    const group = this._groups.get(layerId);
    if (!group) return;

    group.opacity = opacity;
    for (const sublayer of group.sublayers) {
      this._control.setLayerOpacity(sublayer, opacity);
    }
  }

  /**
   * Get the native MapLibre layer IDs for a source-layer group.
   * This enables style editing in the layer control.
   */
  getNativeLayerIds(layerId: string): string[] {
    const group = this._groups.get(layerId);
    return group ? [...group.sublayers] : [];
  }

  /**
   * Remove is not supported at the group level — remove the entire PMTiles
   * source via the PMTilesLayerControl instead.
   */
  removeLayer(_layerId: string): void {
    // Individual source-layer groups can't be removed independently;
    // removing requires removing the entire PMTiles source.
  }

  /**
   * Subscribe to layer changes.
   */
  onLayerChange(
    callback: (event: "add" | "remove", layerId: string) => void,
  ): () => void {
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
}
