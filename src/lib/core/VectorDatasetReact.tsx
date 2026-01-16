import { useEffect, useRef } from 'react';
import { VectorDatasetControl } from './VectorDataset';
import type {
  VectorDatasetControlReactProps,
  VectorDatasetControlState,
  LoadedDataset,
} from './types';

/**
 * React wrapper component for VectorDatasetControl.
 *
 * @example
 * ```tsx
 * import { VectorDatasetReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <VectorDatasetReact
 *           map={map}
 *           fitBounds={true}
 *           onDatasetLoad={(dataset) => console.log('Loaded:', dataset.filename)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and control options.
 * @returns null - This component renders nothing directly.
 */
export function VectorDatasetReact({
  map,
  onDatasetLoad,
  onError,
  onStateChange,
  position = 'top-right',
  ...options
}: VectorDatasetControlReactProps): null {
  const controlRef = useRef<VectorDatasetControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new VectorDatasetControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: VectorDatasetControlState }) => {
        onStateChange(event.state);
      };
      control.on('update', handleChange);
      control.on('show', handleChange);
      control.on('hide', handleChange);
    }

    if (onDatasetLoad) {
      const handleLoad = (event: { dataset?: LoadedDataset }) => {
        if (event.dataset) {
          onDatasetLoad(event.dataset);
        }
      };
      control.on('load', handleLoad);
    }

    if (onError) {
      const handleError = (event: { error?: string; filename?: string }) => {
        if (event.error) {
          onError(event.error, event.filename);
        }
      };
      control.on('error', handleError);
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
        Object.entries(options).filter(([, value]) => value !== undefined)
      );
      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.visible,
    options.showDropZone,
    options.fitBounds,
    options.fitBoundsPadding,
    options.backgroundColor,
    options.borderRadius,
    options.opacity,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
