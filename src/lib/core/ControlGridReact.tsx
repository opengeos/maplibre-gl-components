import { useEffect, useRef } from "react";
import { ControlGrid } from "./ControlGrid";
import type { ControlGridReactProps, ControlGridState } from "./types";

/**
 * React wrapper component for ControlGrid.
 *
 * @example
 * ```tsx
 * import { ControlGridReact, TerrainControl, SearchControl } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *   const terrainRef = useRef(new TerrainControl());
 *   const searchRef = useRef(new SearchControl());
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <ControlGridReact
 *           map={map}
 *           title="Tools"
 *           rows={2}
 *           columns={2}
 *           controls={[terrainRef.current, searchRef.current]}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function ControlGridReact({
  map,
  onStateChange,
  position = "top-right",
  controls: controlsProp = [],
  ...options
}: ControlGridReactProps): null {
  const gridRef = useRef<ControlGrid | null>(null);

  useEffect(() => {
    if (!map) return;

    const grid = new ControlGrid({
      position,
      ...options,
      controls: [], // Sync via effect below to avoid duplicate mount
    });
    gridRef.current = grid;

    if (onStateChange) {
      const handleChange = (event: { state: ControlGridState }) => {
        onStateChange(event.state);
      };
      grid.on("update", handleChange);
      grid.on("show", handleChange);
      grid.on("hide", handleChange);
      grid.on("expand", handleChange);
      grid.on("collapse", handleChange);
    }

    map.addControl(grid, position);

    return () => {
      if (map.hasControl(grid)) {
        map.removeControl(grid);
      }
      gridRef.current = null;
    };
  }, [map, position, onStateChange]);

  // Sync controls when the controls prop changes
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const current = grid.getControls();
    const next = controlsProp;

    for (const c of next) {
      if (!current.includes(c)) {
        grid.addControl(c);
      }
    }
    for (const c of current) {
      if (!next.includes(c)) {
        grid.removeControl(c);
      }
    }
  }, [controlsProp]);

  // Update other options when they change
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updates: Partial<typeof options> = {};
    if (options.visible !== undefined) updates.visible = options.visible;
    if (options.collapsed !== undefined) updates.collapsed = options.collapsed;
    if (options.title !== undefined) updates.title = options.title;
    if (options.rows !== undefined) updates.rows = options.rows;
    if (options.columns !== undefined) updates.columns = options.columns;
    if (options.showRowColumnControls !== undefined)
      updates.showRowColumnControls = options.showRowColumnControls;
    if (options.collapsible !== undefined)
      updates.collapsible = options.collapsible;
    if (options.backgroundColor !== undefined)
      updates.backgroundColor = options.backgroundColor;
    if (options.padding !== undefined) updates.padding = options.padding;
    if (options.borderRadius !== undefined)
      updates.borderRadius = options.borderRadius;
    if (options.opacity !== undefined) updates.opacity = options.opacity;
    if (options.gap !== undefined) updates.gap = options.gap;
    if (options.minzoom !== undefined) updates.minzoom = options.minzoom;
    if (options.maxzoom !== undefined) updates.maxzoom = options.maxzoom;

    if (Object.keys(updates).length > 0) {
      grid.update(updates);
    }
  }, [
    options.visible,
    options.collapsed,
    options.title,
    options.rows,
    options.columns,
    options.showRowColumnControls,
    options.collapsible,
    options.backgroundColor,
    options.padding,
    options.borderRadius,
    options.opacity,
    options.gap,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
