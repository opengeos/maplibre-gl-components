import { useState, useCallback } from 'react';
import type { ViewStateControlState } from '../core/types';

const DEFAULT_STATE: ViewStateControlState = {
  visible: true,
  collapsed: true,
  center: [0, 0],
  bounds: [0, 0, 0, 0],
  zoom: 0,
  pitch: 0,
  bearing: 0,
  drawingBBox: false,
  drawnBBox: null,
};

/**
 * React hook for managing ViewStateControl state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, expand, collapse, toggle, startBBoxDraw, clearBBox } = useViewState({
 *   collapsed: false
 * });
 *
 * return (
 *   <>
 *     <button onClick={toggle}>
 *       {state.collapsed ? 'Show' : 'Hide'} View State
 *     </button>
 *     <ViewStateControlReact
 *       map={map}
 *       collapsed={state.collapsed}
 *       onStateChange={setState}
 *     />
 *   </>
 * );
 * ```
 */
export function useViewState(initialState?: Partial<ViewStateControlState>) {
  const [state, setState] = useState<ViewStateControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
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

  const setDrawingBBox = useCallback((drawingBBox: boolean) => {
    setState((prev) => ({ ...prev, drawingBBox }));
  }, []);

  const setDrawnBBox = useCallback((drawnBBox: [number, number, number, number] | null) => {
    setState((prev) => ({ ...prev, drawnBBox }));
  }, []);

  const clearBBox = useCallback(() => {
    setState((prev) => ({ ...prev, drawnBBox: null, drawingBBox: false }));
  }, []);

  const show = useCallback(() => {
    setState((prev) => ({ ...prev, visible: true }));
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setCollapsed,
    expand,
    collapse,
    toggle,
    setDrawingBBox,
    setDrawnBBox,
    clearBBox,
    show,
    hide,
    reset,
  };
}
