import { useState, useCallback } from 'react';
import type { BasemapControlState } from '../core/types';

const DEFAULT_STATE: BasemapControlState = {
  visible: true,
  collapsed: true,
  selectedBasemap: null,
  searchText: '',
  loading: false,
  error: null,
  belowLabels: false,
};

/**
 * React hook for managing basemap control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setBasemap, setSearch, toggle } = useBasemap({
 *   selectedBasemap: 'OpenStreetMap.Mapnik'
 * });
 *
 * return (
 *   <BasemapReact
 *     map={map}
 *     defaultBasemap={state.selectedBasemap}
 *     visible={state.visible}
 *     collapsed={state.collapsed}
 *   />
 * );
 * ```
 */
export function useBasemap(initialState?: Partial<BasemapControlState>) {
  const [state, setState] = useState<BasemapControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setBasemap = useCallback((basemapId: string | null) => {
    setState((prev) => ({ ...prev, selectedBasemap: basemapId }));
  }, []);

  const setSearch = useCallback((searchText: string) => {
    setState((prev) => ({ ...prev, searchText }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setBelowLabels = useCallback((belowLabels: boolean) => {
    setState((prev) => ({ ...prev, belowLabels }));
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

  const toggleVisibility = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const clearSearch = useCallback(() => {
    setState((prev) => ({ ...prev, searchText: '' }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setCollapsed,
    setBasemap,
    setSearch,
    setLoading,
    setError,
    setBelowLabels,
    show,
    hide,
    expand,
    collapse,
    toggle,
    toggleVisibility,
    clearSearch,
    reset,
  };
}
