import { useEffect, useRef } from 'react';
import { HtmlControl } from './HtmlControl';
import type { HtmlControlReactProps, HtmlControlState } from './types';

/**
 * React wrapper component for HtmlControl.
 *
 * @example
 * ```tsx
 * import { HtmlControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *   const [stats, setStats] = useState('Loading...');
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <HtmlControlReact
 *           map={map}
 *           html={`<div><strong>Stats:</strong> ${stats}</div>`}
 *           position="top-left"
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
export function HtmlControlReact({
  map,
  onStateChange,
  position = 'top-left',
  ...options
}: HtmlControlReactProps): null {
  const controlRef = useRef<HtmlControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new HtmlControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: HtmlControlState }) => {
        onStateChange(event.state);
      };
      control.on('update', handleChange);
      control.on('show', handleChange);
      control.on('hide', handleChange);
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map, position, onStateChange]);

  // Update HTML content when it changes
  useEffect(() => {
    if (controlRef.current && options.html !== undefined) {
      controlRef.current.setHtml(options.html);
    }
  }, [options.html]);

  // Update other options when they change
  useEffect(() => {
    if (controlRef.current) {
      // Only pass defined values to avoid overwriting defaults with undefined
      const updates: Partial<typeof options> = {};
      if (options.visible !== undefined) updates.visible = options.visible;
      if (options.backgroundColor !== undefined) updates.backgroundColor = options.backgroundColor;
      if (options.padding !== undefined) updates.padding = options.padding;
      if (options.borderRadius !== undefined) updates.borderRadius = options.borderRadius;
      if (options.opacity !== undefined) updates.opacity = options.opacity;
      if (options.maxWidth !== undefined) updates.maxWidth = options.maxWidth;
      if (options.maxHeight !== undefined) updates.maxHeight = options.maxHeight;

      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.visible,
    options.backgroundColor,
    options.padding,
    options.borderRadius,
    options.opacity,
    options.maxWidth,
    options.maxHeight,
  ]);

  return null;
}
