import { useEffect, useRef } from 'react';
import { Legend } from './Legend';
import type { LegendReactProps, LegendState } from './types';

/**
 * React wrapper component for Legend.
 *
 * @example
 * ```tsx
 * import { LegendReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <LegendReact
 *           map={map}
 *           title="Land Use"
 *           items={[
 *             { label: 'Residential', color: '#ff6b6b' },
 *             { label: 'Commercial', color: '#4ecdc4' },
 *           ]}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and legend options.
 * @returns null - This component renders nothing directly.
 */
export function LegendReact({
  map,
  onStateChange,
  position = 'bottom-left',
  ...options
}: LegendReactProps): null {
  const controlRef = useRef<Legend | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new Legend({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: LegendState }) => {
        onStateChange(event.state);
      };
      control.on('update', handleChange);
      control.on('show', handleChange);
      control.on('hide', handleChange);
      control.on('collapse', handleChange);
      control.on('expand', handleChange);
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
    options.items,
    options.title,
    options.visible,
    options.collapsed,
    options.collapsible,
    options.width,
    options.maxHeight,
    options.backgroundColor,
    options.opacity,
    options.fontSize,
    options.fontColor,
    options.swatchSize,
  ]);

  return null;
}
