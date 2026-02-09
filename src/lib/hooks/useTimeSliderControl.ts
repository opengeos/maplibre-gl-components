import { useState, useCallback } from "react";
import type { TimeSliderControlState } from "../core/types";

const DEFAULT_STATE: TimeSliderControlState = {
  visible: true,
  collapsed: true,
  value: 0,
  playing: false,
  min: 0,
  max: 100,
};

/**
 * React hook for managing time slider control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, play, pause, setValue } = useTimeSliderControl({
 *   collapsed: true,
 *   min: 0,
 *   max: 100,
 * });
 *
 * return (
 *   <TimeSliderControlReact
 *     map={map}
 *     min={state.min}
 *     max={state.max}
 *     value={state.value}
 *   />
 * );
 * ```
 */
export function useTimeSliderControl(
  initialState?: Partial<TimeSliderControlState>,
) {
  const [state, setState] = useState<TimeSliderControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const show = useCallback(() => {
    setState((prev) => ({ ...prev, visible: true }));
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const expand = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: false }));
  }, []);

  const collapse = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: true }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const play = useCallback(() => {
    setState((prev) => ({ ...prev, playing: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const setValue = useCallback((value: number) => {
    setState((prev) => ({ ...prev, value }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setCollapsed,
    show,
    hide,
    expand,
    collapse,
    toggle,
    play,
    pause,
    setValue,
    reset,
  };
}
