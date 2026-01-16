import { useEffect, useRef } from 'react';
import { SearchControl } from './SearchControl';
import type { SearchControlReactProps, SearchControlState, SearchResult } from './types';

/**
 * React wrapper component for SearchControl.
 *
 * @example
 * ```tsx
 * import { SearchControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <SearchControlReact
 *           map={map}
 *           position="top-right"
 *           placeholder="Search for a place..."
 *           onResultSelect={(result) => console.log('Selected:', result)}
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
export function SearchControlReact({
  map,
  onResultSelect,
  onStateChange,
  position = 'top-right',
  ...options
}: SearchControlReactProps): null {
  const controlRef = useRef<SearchControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new SearchControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: SearchControlState }) => {
        onStateChange(event.state);
      };
      control.on('update', handleChange);
      control.on('show', handleChange);
      control.on('hide', handleChange);
      control.on('expand', handleChange);
      control.on('collapse', handleChange);
      control.on('search', handleChange);
      control.on('clear', handleChange);
    }

    if (onResultSelect) {
      control.on('resultselect', (event: { result?: SearchResult }) => {
        if (event.result) {
          onResultSelect(event.result);
        }
      });
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map, position, onStateChange, onResultSelect]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      const updates: Partial<typeof options> = {};
      if (options.visible !== undefined) updates.visible = options.visible;
      if (options.collapsed !== undefined) updates.collapsed = options.collapsed;
      if (options.placeholder !== undefined) updates.placeholder = options.placeholder;
      if (options.maxResults !== undefined) updates.maxResults = options.maxResults;
      if (options.flyToZoom !== undefined) updates.flyToZoom = options.flyToZoom;
      if (options.showMarker !== undefined) updates.showMarker = options.showMarker;
      if (options.markerColor !== undefined) updates.markerColor = options.markerColor;
      if (options.backgroundColor !== undefined) updates.backgroundColor = options.backgroundColor;
      if (options.borderRadius !== undefined) updates.borderRadius = options.borderRadius;
      if (options.opacity !== undefined) updates.opacity = options.opacity;
      if (options.width !== undefined) updates.width = options.width;
      if (options.fontSize !== undefined) updates.fontSize = options.fontSize;
      if (options.fontColor !== undefined) updates.fontColor = options.fontColor;
      if (options.minzoom !== undefined) updates.minzoom = options.minzoom;
      if (options.maxzoom !== undefined) updates.maxzoom = options.maxzoom;

      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.visible,
    options.collapsed,
    options.placeholder,
    options.maxResults,
    options.flyToZoom,
    options.showMarker,
    options.markerColor,
    options.backgroundColor,
    options.borderRadius,
    options.opacity,
    options.width,
    options.fontSize,
    options.fontColor,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
