import { useEffect, useRef } from "react";
import { MinimapControl } from "./MinimapControl";
import type { MinimapControlReactProps, MinimapControlState } from "./types";

/**
 * React wrapper component for MinimapControl.
 *
 * @example
 * ```tsx
 * import { MinimapControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <MinimapControlReact
 *           map={map}
 *           width={250}
 *           height={180}
 *           interactive={true}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and minimap options.
 * @returns null - This component renders nothing directly.
 */
export function MinimapControlReact({
  map,
  onStateChange,
  position = "bottom-left",
  ...options
}: MinimapControlReactProps): null {
  const controlRef = useRef<MinimapControl | null>(null);

  useEffect(() => {
    if (!map) return;

    const control = new MinimapControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: MinimapControlState }) => {
        onStateChange(event.state);
      };
      control.on("show", handleChange);
      control.on("hide", handleChange);
      control.on("expand", handleChange);
      control.on("collapse", handleChange);
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map]);

  return null;
}
