import { useEffect, useRef } from "react";
import { InspectControl } from "./InspectControl";
import type {
  InspectControlReactProps,
  InspectControlState,
  InspectedFeature,
} from "./types";

/**
 * React wrapper component for InspectControl.
 *
 * @example
 * ```tsx
 * import { InspectControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <InspectControlReact
 *           map={map}
 *           position="top-right"
 *           excludeLayers={['background']}
 *           onFeatureSelect={(feature) => console.log('Selected:', feature)}
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
export function InspectControlReact({
  map,
  onFeatureSelect,
  onInspect,
  onToggle,
  onStateChange,
  position = "top-right",
  ...options
}: InspectControlReactProps): null {
  const controlRef = useRef<InspectControl | null>(null);

  // Add control on mount
  useEffect(() => {
    if (!map) return;

    const control = new InspectControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: InspectControlState }) => {
        onStateChange(event.state);
      };
      control.on("update", handleChange);
      control.on("show", handleChange);
      control.on("hide", handleChange);
      control.on("enable", handleChange);
      control.on("disable", handleChange);
      control.on("clear", handleChange);
    }

    if (onFeatureSelect) {
      control.on("featureselect", (event: { feature?: InspectedFeature }) => {
        onFeatureSelect(event.feature || null);
      });
    }

    if (onInspect) {
      control.on(
        "featureselect",
        (event: { features?: InspectedFeature[] }) => {
          if (event.features) {
            onInspect(event.features);
          }
        },
      );
    }

    if (onToggle) {
      control.on("enable", () => onToggle(true));
      control.on("disable", () => onToggle(false));
    }

    map.addControl(control, position);

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map, position, onStateChange, onFeatureSelect, onInspect, onToggle]);

  // Update options when they change
  useEffect(() => {
    if (controlRef.current) {
      const updates: Partial<typeof options> = {};
      if (options.visible !== undefined) updates.visible = options.visible;
      if (options.enabled !== undefined) updates.enabled = options.enabled;
      if (options.maxFeatures !== undefined)
        updates.maxFeatures = options.maxFeatures;
      if (options.showGeometryType !== undefined)
        updates.showGeometryType = options.showGeometryType;
      if (options.showLayerName !== undefined)
        updates.showLayerName = options.showLayerName;
      if (options.maxWidth !== undefined) updates.maxWidth = options.maxWidth;
      if (options.maxHeight !== undefined)
        updates.maxHeight = options.maxHeight;
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
    options.enabled,
    options.maxFeatures,
    options.showGeometryType,
    options.showLayerName,
    options.maxWidth,
    options.maxHeight,
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
