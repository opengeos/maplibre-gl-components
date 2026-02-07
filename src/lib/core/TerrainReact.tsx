import { useEffect, useRef } from "react";
import { TerrainControl } from "./Terrain";
import type { TerrainControlReactProps, TerrainControlState } from "./types";

/**
 * React wrapper component for TerrainControl.
 *
 * @example
 * ```tsx
 * import { TerrainReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <TerrainReact
 *           map={map}
 *           exaggeration={1.5}
 *           hillshade={true}
 *           onTerrainChange={(enabled) => console.log('Terrain:', enabled)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and terrain options.
 * @returns null - This component renders nothing directly.
 */
export function TerrainReact({
  map,
  onTerrainChange,
  onStateChange,
  position = "top-right",
  ...options
}: TerrainControlReactProps): null {
  const controlRef = useRef<TerrainControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new TerrainControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: TerrainControlState }) => {
        onStateChange(event.state);
      };
      control.on("update", handleChange);
      control.on("show", handleChange);
      control.on("hide", handleChange);
    }

    if (onTerrainChange) {
      const handleTerrainChange = (event: { state: TerrainControlState }) => {
        onTerrainChange(event.state.enabled);
      };
      control.on("terrainchange", handleTerrainChange);
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      // Filter out undefined values to avoid overwriting defaults
      const updates = Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.enabled,
    options.exaggeration,
    options.hillshade,
    options.hillshadeExaggeration,
    options.visible,
    options.backgroundColor,
    options.borderRadius,
    options.opacity,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
