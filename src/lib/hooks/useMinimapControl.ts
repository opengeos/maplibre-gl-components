import { useState, useCallback } from "react";
import type { MinimapControlState } from "../core/types";

const DEFAULT_STATE: MinimapControlState = {
  visible: true,
  collapsed: false,
};

/**
 * React hook for managing minimap control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, expand, collapse, toggle } = useMinimapControl({
 *   collapsed: false,
 * });
 *
 * return (
 *   <MinimapControlReact
 *     map={map}
 *     collapsed={state.collapsed}
 *     visible={state.visible}
 *   />
 * );
 * ```
 */
export function useMinimapControl(initialState?: Partial<MinimapControlState>) {
  const [state, setState] = useState<MinimapControlState>({
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
    reset,
  };
}
