import { useEffect, useRef } from 'react';
import { Colorbar } from './Colorbar';
import type { ColorbarReactProps, ColorbarState } from './types';

/**
 * React wrapper component for Colorbar.
 *
 * @example
 * ```tsx
 * import { ColorbarReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <ColorbarReact
 *           map={map}
 *           colormap="viridis"
 *           vmin={0}
 *           vmax={100}
 *           label="Temperature"
 *           units="°C"
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and colorbar options.
 * @returns null - This component renders nothing directly.
 */
export function ColorbarReact({
  map,
  onStateChange,
  position = 'bottom-right',
  ...options
}: ColorbarReactProps): null {
  const controlRef = useRef<Colorbar | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new Colorbar({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      control.on('update', (event) => {
        onStateChange(event.state as ColorbarState);
      });
      control.on('show', (event) => {
        onStateChange(event.state as ColorbarState);
      });
      control.on('hide', (event) => {
        onStateChange(event.state as ColorbarState);
      });
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
      controlRef.current.update(options);
    }
  }, [
    options.colormap,
    options.colorStops,
    options.vmin,
    options.vmax,
    options.label,
    options.units,
    options.visible,
    options.orientation,
    options.barThickness,
    options.barLength,
    options.backgroundColor,
    options.opacity,
    options.fontSize,
    options.fontColor,
  ]);

  return null;
}
