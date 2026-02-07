import { useEffect, useRef } from "react";
import { ViewStateControl } from "./ViewStateControl";
import type {
  ViewStateControlReactProps,
  ViewStateControlState,
} from "./types";

/**
 * React wrapper component for ViewStateControl.
 *
 * @example
 * ```tsx
 * import { ViewStateControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <ViewStateControlReact
 *           map={map}
 *           position="bottom-left"
 *           enableBBox={true}
 *           onBBoxDraw={(bbox) => console.log('BBox:', bbox)}
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
export function ViewStateControlReact({
  map,
  onBBoxDraw,
  onDrawingToggle,
  onStateChange,
  position = "bottom-left",
  ...options
}: ViewStateControlReactProps): null {
  const controlRef = useRef<ViewStateControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new ViewStateControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: ViewStateControlState }) => {
        onStateChange(event.state);
      };
      control.on("update", handleChange);
      control.on("show", handleChange);
      control.on("hide", handleChange);
      control.on("expand", handleChange);
      control.on("collapse", handleChange);
      control.on("viewchange", handleChange);
    }

    if (onBBoxDraw) {
      control.on(
        "bboxdraw",
        (event: { bbox?: [number, number, number, number] }) => {
          if (event.bbox) {
            onBBoxDraw(event.bbox);
          }
        },
      );
    }

    if (onDrawingToggle) {
      control.on("drawstart", () => onDrawingToggle(true));
      control.on("drawend", () => onDrawingToggle(false));
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map, position, onStateChange, onBBoxDraw, onDrawingToggle]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      const updates: Partial<typeof options> = {};
      if (options.visible !== undefined) updates.visible = options.visible;
      if (options.collapsed !== undefined)
        updates.collapsed = options.collapsed;
      if (options.precision !== undefined)
        updates.precision = options.precision;
      if (options.panelWidth !== undefined)
        updates.panelWidth = options.panelWidth;
      if (options.backgroundColor !== undefined)
        updates.backgroundColor = options.backgroundColor;
      if (options.borderRadius !== undefined)
        updates.borderRadius = options.borderRadius;
      if (options.opacity !== undefined) updates.opacity = options.opacity;
      if (options.fontSize !== undefined) updates.fontSize = options.fontSize;
      if (options.fontColor !== undefined)
        updates.fontColor = options.fontColor;
      if (options.minzoom !== undefined) updates.minzoom = options.minzoom;
      if (options.maxzoom !== undefined) updates.maxzoom = options.maxzoom;

      if (Object.keys(updates).length > 0) {
        controlRef.current.update(updates);
      }
    }
  }, [
    options.visible,
    options.collapsed,
    options.precision,
    options.panelWidth,
    options.backgroundColor,
    options.borderRadius,
    options.opacity,
    options.fontSize,
    options.fontColor,
    options.minzoom,
    options.maxzoom,
  ]);

  return null;
}
