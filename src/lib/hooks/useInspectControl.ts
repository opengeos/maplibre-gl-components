import { useState, useCallback } from 'react';
import type { InspectControlState, InspectedFeature } from '../core/types';

const DEFAULT_STATE: InspectControlState = {
  visible: true,
  enabled: false,
  inspectedFeatures: [],
  selectedIndex: 0,
  error: null,
};

/**
 * React hook for managing InspectControl state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, enable, disable, toggle, nextFeature, previousFeature } = useInspectControl({
 *   enabled: false
 * });
 *
 * return (
 *   <>
 *     <button onClick={toggle}>
 *       {state.enabled ? 'Disable' : 'Enable'} Inspect
 *     </button>
 *     <InspectControlReact
 *       map={map}
 *       enabled={state.enabled}
 *       onToggle={(enabled) => enabled ? enable() : disable()}
 *       onFeatureSelect={(feature) => console.log(feature)}
 *     />
 *   </>
 * );
 * ```
 */
export function useInspectControl(initialState?: Partial<InspectControlState>) {
  const [state, setState] = useState<InspectControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }));
  }, []);

  const enable = useCallback(() => {
    setState((prev) => ({ ...prev, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setState((prev) => ({
      ...prev,
      enabled: false,
      inspectedFeatures: [],
      selectedIndex: 0,
    }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      inspectedFeatures: prev.enabled ? [] : prev.inspectedFeatures,
      selectedIndex: prev.enabled ? 0 : prev.selectedIndex,
    }));
  }, []);

  const setInspectedFeatures = useCallback((features: InspectedFeature[]) => {
    setState((prev) => ({
      ...prev,
      inspectedFeatures: features,
      selectedIndex: 0,
    }));
  }, []);

  const selectFeature = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      selectedIndex: Math.max(0, Math.min(index, prev.inspectedFeatures.length - 1)),
    }));
  }, []);

  const nextFeature = useCallback(() => {
    setState((prev) => {
      if (prev.inspectedFeatures.length <= 1) return prev;
      return {
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % prev.inspectedFeatures.length,
      };
    });
  }, []);

  const previousFeature = useCallback(() => {
    setState((prev) => {
      if (prev.inspectedFeatures.length <= 1) return prev;
      return {
        ...prev,
        selectedIndex:
          prev.selectedIndex === 0
            ? prev.inspectedFeatures.length - 1
            : prev.selectedIndex - 1,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({
      ...prev,
      inspectedFeatures: [],
      selectedIndex: 0,
      error: null,
    }));
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

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  // Computed values
  const currentFeature = state.inspectedFeatures[state.selectedIndex] || null;
  const featureCount = state.inspectedFeatures.length;

  return {
    state,
    setState,
    setVisible,
    setEnabled,
    enable,
    disable,
    toggle,
    setInspectedFeatures,
    selectFeature,
    nextFeature,
    previousFeature,
    clear,
    setError,
    show,
    hide,
    reset,
    // Computed values
    currentFeature,
    featureCount,
  };
}
