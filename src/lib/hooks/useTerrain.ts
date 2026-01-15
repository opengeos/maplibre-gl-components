import { useState, useCallback } from 'react';
import type { TerrainControlState } from '../core/types';

const DEFAULT_STATE: TerrainControlState = {
  visible: true,
  enabled: false,
  exaggeration: 1.0,
  hillshade: true,
};

/**
 * React hook for managing terrain control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, enable, disable, toggle, setExaggeration } = useTerrain({
 *   enabled: false,
 *   exaggeration: 1.5,
 * });
 *
 * return (
 *   <TerrainReact
 *     map={map}
 *     enabled={state.enabled}
 *     exaggeration={state.exaggeration}
 *     hillshade={state.hillshade}
 *   />
 * );
 * ```
 */
export function useTerrain(initialState?: Partial<TerrainControlState>) {
  const [state, setState] = useState<TerrainControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }));
  }, []);

  const setExaggeration = useCallback((exaggeration: number) => {
    const clampedValue = Math.max(0.1, Math.min(10, exaggeration));
    setState((prev) => ({ ...prev, exaggeration: clampedValue }));
  }, []);

  const setHillshade = useCallback((hillshade: boolean) => {
    setState((prev) => ({ ...prev, hillshade }));
  }, []);

  const enable = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const show = useCallback(() => {
    setState((prev) => ({ ...prev, visible: true }));
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleVisibility = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const enableHillshade = useCallback(() => {
    setState((prev) => ({ ...prev, hillshade: true }));
  }, []);

  const disableHillshade = useCallback(() => {
    setState((prev) => ({ ...prev, hillshade: false }));
  }, []);

  const toggleHillshade = useCallback(() => {
    setState((prev) => ({ ...prev, hillshade: !prev.hillshade }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setEnabled,
    setExaggeration,
    setHillshade,
    enable,
    disable,
    toggle,
    show,
    hide,
    toggleVisibility,
    enableHillshade,
    disableHillshade,
    toggleHillshade,
    reset,
  };
}
