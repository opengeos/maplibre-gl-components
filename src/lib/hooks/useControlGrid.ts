import { useState, useCallback } from 'react';
import type { ControlGridState } from '../core/types';

const DEFAULT_STATE: ControlGridState = {
  visible: true,
  collapsed: false,
  rows: 2,
  columns: 2,
};

/**
 * React hook for managing ControlGrid state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setRows, setColumns, expand, collapse } = useControlGrid({
 *   rows: 2,
 *   columns: 2,
 *   collapsed: true,
 * });
 *
 * return (
 *   <ControlGridReact
 *     map={map}
 *     rows={state.rows}
 *     columns={state.columns}
 *     collapsed={state.collapsed}
 *     controls={[terrainControl, searchControl]}
 *   />
 * );
 * ```
 */
export function useControlGrid(initialState?: Partial<ControlGridState>) {
  const [state, setState] = useState<ControlGridState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setRows = useCallback((rows: number) => {
    setState((prev) => ({ ...prev, rows: Math.max(1, Math.min(12, Math.round(rows))) }));
  }, []);

  const setColumns = useCallback((columns: number) => {
    setState((prev) => ({
      ...prev,
      columns: Math.max(1, Math.min(12, Math.round(columns))),
    }));
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
    setRows,
    setColumns,
    expand,
    collapse,
    toggle,
    show,
    hide,
    reset,
  };
}
