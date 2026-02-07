import { useEffect, useRef } from "react";
import { BasemapControl } from "./Basemap";
import type {
  BasemapControlReactProps,
  BasemapControlState,
  BasemapItem,
} from "./types";

/**
 * React wrapper component for BasemapControl.
 *
 * @example
 * ```tsx
 * import { BasemapReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <BasemapReact
 *           map={map}
 *           defaultBasemap="OpenStreetMap.Mapnik"
 *           showSearch
 *           onBasemapChange={(basemap) => console.log('Changed to:', basemap.name)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and basemap control options.
 * @returns null - This component renders nothing directly.
 */
export function BasemapReact({
  map,
  onBasemapChange,
  onStateChange,
  position = "top-right",
  ...options
}: BasemapControlReactProps): null {
  const controlRef = useRef<BasemapControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new BasemapControl({ position, ...options });
    controlRef.current = control;

    // Set up event handlers
    if (onStateChange) {
      const handleChange = (event: { state: BasemapControlState }) => {
        onStateChange(event.state);
      };
      control.on("update", handleChange);
      control.on("show", handleChange);
      control.on("hide", handleChange);
      control.on("collapse", handleChange);
      control.on("expand", handleChange);
    }

    if (onBasemapChange) {
      const handleBasemapChange = (event: { basemap?: BasemapItem }) => {
        if (event.basemap) {
          onBasemapChange(event.basemap);
        }
      };
      control.on("basemapchange", handleBasemapChange);
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
    options.basemaps,
    options.defaultBasemap,
    options.visible,
    options.collapsed,
    options.collapsible,
    options.displayMode,
    options.showSearch,
    options.filterGroups,
    options.excludeGroups,
    options.excludeBroken,
    options.backgroundColor,
    options.padding,
    options.borderRadius,
    options.opacity,
    options.maxWidth,
    options.maxHeight,
    options.fontSize,
    options.fontColor,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
