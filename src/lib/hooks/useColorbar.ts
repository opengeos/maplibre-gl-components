import { useState, useCallback } from "react";
import type { ColorbarState, ColormapName } from "../core/types";

const DEFAULT_STATE: ColorbarState = {
  visible: true,
  vmin: 0,
  vmax: 1,
  colormap: "viridis",
};

/**
 * React hook for managing colorbar state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setVmin, setVmax, setColormap, toggle } = useColorbar();
 *
 * return (
 *   <ColorbarReact
 *     map={map}
 *     vmin={state.vmin}
 *     vmax={state.vmax}
 *     colormap={state.colormap}
 *     visible={state.visible}
 *   />
 * );
 * ```
 */
export function useColorbar(initialState?: Partial<ColorbarState>) {
  const [state, setState] = useState<ColorbarState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setVmin = useCallback((vmin: number) => {
    setState((prev) => ({ ...prev, vmin }));
  }, []);

  const setVmax = useCallback((vmax: number) => {
    setState((prev) => ({ ...prev, vmax }));
  }, []);

  const setRange = useCallback((vmin: number, vmax: number) => {
    setState((prev) => ({ ...prev, vmin, vmax }));
  }, []);

  const setColormap = useCallback((colormap: ColormapName | string[]) => {
    setState((prev) => ({ ...prev, colormap }));
  }, []);

  const show = useCallback(() => {
    setState((prev) => ({ ...prev, visible: true }));
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setVmin,
    setVmax,
    setRange,
    setColormap,
    show,
    hide,
    toggle,
    reset,
  };
}
