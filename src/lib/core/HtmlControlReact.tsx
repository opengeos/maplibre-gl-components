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
  }, [map]);

  // Update HTML content when it changes
  useEffect(() => {
    if (controlRef.current && options.html !== undefined) {
      controlRef.current.setHtml(options.html);
    }
  }, [options.html]);

  // Update other options when they change
  useEffect(() => {
    if (controlRef.current) {
      controlRef.current.update({
        visible: options.visible,
        backgroundColor: options.backgroundColor,
        padding: options.padding,
        borderRadius: options.borderRadius,
        opacity: options.opacity,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
      });
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
