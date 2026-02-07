import { useEffect, useRef } from 'react';
import { CogLayerControl } from './CogLayer';
import type { CogLayerControlReactProps, CogLayerControlState } from './types';

/**
 * React wrapper component for CogLayerControl.
 *
 * @example
 * ```tsx
 * import { CogLayerReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <CogLayerReact
 *           map={map}
 *           defaultUrl="https://example.com/cog.tif"
 *           defaultColormap="terrain"
 *           onLayerAdd={(url) => console.log('Added:', url)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and COG layer options.
 * @returns null - This component renders nothing directly.
 */
export function CogLayerReact({
  map,
  onLayerAdd,
  onLayerRemove,
  onLayerUpdate,
  onError,
  onStateChange,
  position = 'top-right',
  ...options
}: CogLayerControlReactProps): null {
  const controlRef = useRef<CogLayerControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new CogLayerControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: CogLayerControlState }) => {
        onStateChange(event.state);
      };
      control.on('update', handleChange);
      control.on('show', handleChange);
      control.on('hide', handleChange);
      control.on('expand', handleChange);
      control.on('collapse', handleChange);
    }

    if (onLayerAdd) {
      control.on('layeradd', (event) => {
        if (event.url) onLayerAdd(event.url);
      });
    }

    if (onLayerRemove) {
      control.on('layerremove', () => {
        onLayerRemove();
      });
    }

    if (onLayerUpdate) {
      control.on('layerupdate', (event) => {
        if (event.url) onLayerUpdate(event.url);
      });
    }

    if (onError) {
      control.on('error', (event) => {
        if (event.error) onError(event.error);
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
      const updates = Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined)
      );
      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.visible,
    options.collapsed,
    options.backgroundColor,
    options.borderRadius,
    options.opacity,
    options.panelWidth,
    options.fontSize,
    options.fontColor,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
