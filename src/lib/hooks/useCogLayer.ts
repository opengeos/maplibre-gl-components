import { useState, useCallback } from "react";
import type { CogLayerControlState, ColormapName } from "../core/types";

const DEFAULT_STATE: CogLayerControlState = {
  visible: true,
  collapsed: true,
  url: "",
  bands: "1",
  colormap: "viridis",
  rescaleMin: 0,
  rescaleMax: 255,
  nodata: 0,
  layerOpacity: 1,
  pickable: true,
  hasLayer: false,
  layerCount: 0,
  layers: [],
  loading: false,
  error: null,
  status: null,
  layerName: "",
};

/**
 * React hook for managing COG layer control state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setUrl, setColormap, setOpacity } = useCogLayer({
 *   url: 'https://example.com/cog.tif',
 *   colormap: 'terrain',
 * });
 *
 * return (
 *   <CogLayerReact
 *     map={map}
 *     defaultUrl={state.url}
 *     defaultColormap={state.colormap}
 *   />
 * );
 * ```
 */
export function useCogLayer(initialState?: Partial<CogLayerControlState>) {
  const [state, setState] = useState<CogLayerControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setUrl = useCallback((url: string) => {
    setState((prev) => ({ ...prev, url }));
  }, []);

  const setBands = useCallback((bands: string) => {
    setState((prev) => ({ ...prev, bands }));
  }, []);

  const setColormap = useCallback((colormap: ColormapName | "none") => {
    setState((prev) => ({ ...prev, colormap }));
  }, []);

  const setRescaleMin = useCallback((rescaleMin: number) => {
    setState((prev) => ({ ...prev, rescaleMin }));
  }, []);

  const setRescaleMax = useCallback((rescaleMax: number) => {
    setState((prev) => ({ ...prev, rescaleMax }));
  }, []);

  const setNodata = useCallback((nodata: number | undefined) => {
    setState((prev) => ({ ...prev, nodata }));
  }, []);

  const setOpacity = useCallback((layerOpacity: number) => {
    const clamped = Math.max(0, Math.min(1, layerOpacity));
    setState((prev) => ({ ...prev, layerOpacity: clamped }));
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

  const toggleVisibility = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const togglePanel = useCallback(() => {
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
    setUrl,
    setBands,
    setColormap,
    setRescaleMin,
    setRescaleMax,
    setNodata,
    setOpacity,
    show,
    hide,
    expand,
    collapse,
    toggleVisibility,
    togglePanel,
    reset,
  };
}
