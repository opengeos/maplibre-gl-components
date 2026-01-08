import { useState, useCallback } from 'react';
import type { LegendState, LegendItem } from '../core/types';

const DEFAULT_STATE: LegendState = {
  visible: true,
  collapsed: false,
  items: [],
};

/**
 * React hook for managing legend state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setItems, addItem, removeItem, toggle } = useLegend({
 *   items: [{ label: 'Water', color: '#4169E1' }]
 * });
 *
 * return (
 *   <LegendReact
 *     map={map}
 *     items={state.items}
 *     visible={state.visible}
 *     collapsed={state.collapsed}
 *   />
 * );
 * ```
 */
export function useLegend(initialState?: Partial<LegendState>) {
  const [state, setState] = useState<LegendState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setItems = useCallback((items: LegendItem[]) => {
    setState((prev) => ({ ...prev, items: [...items] }));
  }, []);

  const addItem = useCallback((item: LegendItem) => {
    setState((prev) => ({ ...prev, items: [...prev.items, item] }));
  }, []);

  const removeItem = useCallback((label: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.label !== label),
    }));
  }, []);

  const updateItem = useCallback((label: string, updates: Partial<LegendItem>) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.label === label ? { ...item, ...updates } : item)),
    }));
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

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setCollapsed,
    setItems,
    addItem,
    removeItem,
    updateItem,
    show,
    hide,
    expand,
    collapse,
    toggle,
    toggleVisibility,
    reset,
  };
}
