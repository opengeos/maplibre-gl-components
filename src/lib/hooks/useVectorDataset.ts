import { useState, useCallback } from 'react';
import type { VectorDatasetControlState, LoadedDataset } from '../core/types';

const DEFAULT_STATE: VectorDatasetControlState = {
  visible: true,
  isDragging: false,
  isLoading: false,
  loadedDatasets: [],
  error: null,
};

/**
 * React hook for managing vector dataset control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, addDataset, removeDataset, clearAll } = useVectorDataset();
 *
 * return (
 *   <VectorDatasetReact
 *     map={map}
 *     visible={state.visible}
 *     onDatasetLoad={(dataset) => addDataset(dataset)}
 *   />
 * );
 * ```
 */
export function useVectorDataset(initialState?: Partial<VectorDatasetControlState>) {
  const [state, setState] = useState<VectorDatasetControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
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

  const addDataset = useCallback((dataset: LoadedDataset) => {
    setState((prev) => ({
      ...prev,
      loadedDatasets: [...prev.loadedDatasets, dataset],
      error: null,
    }));
  }, []);

  const removeDataset = useCallback((datasetId: string) => {
    setState((prev) => ({
      ...prev,
      loadedDatasets: prev.loadedDatasets.filter((d) => d.id !== datasetId),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      loadedDatasets: [],
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    show,
    hide,
    toggleVisibility,
    addDataset,
    removeDataset,
    clearAll,
    setError,
    clearError,
    reset,
  };
}
