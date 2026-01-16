import { useState, useCallback } from 'react';
import type { SearchControlState, SearchResult } from '../core/types';

const DEFAULT_STATE: SearchControlState = {
  visible: true,
  collapsed: true,
  query: '',
  results: [],
  loading: false,
  selectedResult: null,
  error: null,
};

/**
 * React hook for managing SearchControl state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setQuery, expand, collapse, selectResult, clear } = useSearchControl({
 *   collapsed: true
 * });
 *
 * return (
 *   <SearchControlReact
 *     map={map}
 *     visible={state.visible}
 *     collapsed={state.collapsed}
 *     onResultSelect={(result) => selectResult(result)}
 *   />
 * );
 * ```
 */
export function useSearchControl(initialState?: Partial<SearchControlState>) {
  const [state, setState] = useState<SearchControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const setResults = useCallback((results: SearchResult[]) => {
    setState((prev) => ({ ...prev, results }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const selectResult = useCallback((result: SearchResult | null) => {
    setState((prev) => ({ ...prev, selectedResult: result }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
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

  const expand = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: false }));
  }, []);

  const collapse = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: true, results: [] }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      collapsed: !prev.collapsed,
      results: prev.collapsed ? prev.results : [],
    }));
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({
      ...prev,
      query: '',
      results: [],
      selectedResult: null,
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setCollapsed,
    setQuery,
    setResults,
    setLoading,
    selectResult,
    setError,
    show,
    hide,
    expand,
    collapse,
    toggle,
    toggleVisibility,
    clear,
    reset,
  };
}
