import { useEffect, useRef } from "react";
import { TimeSliderControl } from "./TimeSliderControl";
import type {
  TimeSliderControlReactProps,
  TimeSliderControlState,
  TimeSliderValue,
} from "./types";

/**
 * React wrapper component for TimeSliderControl.
 *
 * @example
 * ```tsx
 * import { TimeSliderControlReact } from 'maplibre-gl-components/react';
 *
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <>
 *       <div ref={mapContainer} />
 *       {map && (
 *         <TimeSliderControlReact
 *           map={map}
 *           min={0}
 *           max={100}
 *           fps={2}
 *           onChange={(value) => console.log('Value:', value)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param props - Component props including map instance and time slider options.
 * @returns null - This component renders nothing directly.
 */
export function TimeSliderControlReact({
  map,
  onChange,
  onPlay,
  onPause,
  onStateChange,
  position = "bottom-left",
  ...options
}: TimeSliderControlReactProps): null {
  const controlRef = useRef<TimeSliderControl | null>(null);

  useEffect(() => {
    if (!map) return;

    const control = new TimeSliderControl({ position, ...options });
    controlRef.current = control;

    if (onStateChange) {
      const handleChange = (event: { state: TimeSliderControlState }) => {
        onStateChange(event.state);
      };
      control.on("show", handleChange);
      control.on("hide", handleChange);
      control.on("expand", handleChange);
      control.on("collapse", handleChange);
      control.on("change", handleChange);
    }

    if (onChange) {
      control.on("change", (event) => {
        onChange(event.value as TimeSliderValue, event.index as number);
      });
    }

    if (onPlay) {
      control.on("play", () => onPlay());
    }

    if (onPause) {
      control.on("pause", () => onPause());
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
