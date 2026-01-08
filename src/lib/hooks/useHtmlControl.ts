import { useState, useCallback } from 'react';
import type { HtmlControlState } from '../core/types';

const DEFAULT_STATE: HtmlControlState = {
  visible: true,
  html: '',
};

/**
 * React hook for managing HtmlControl state.
 *
 * @param initialState - Optional initial state.
 * @returns State and state management functions.
 *
 * @example
 * ```tsx
 * const { state, setHtml, show, hide, toggle } = useHtmlControl({
 *   html: '<div>Initial content</div>'
 * });
 *
 * return (
 *   <HtmlControlReact
 *     map={map}
 *     html={state.html}
 *     visible={state.visible}
 *   />
 * );
 * ```
 */
export function useHtmlControl(initialState?: Partial<HtmlControlState>) {
  const [state, setState] = useState<HtmlControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, visible }));
  }, []);

  const setHtml = useCallback((html: string) => {
    setState((prev) => ({ ...prev, html }));
  }, []);

  const show = useCallback(() => {
    setState((prev) => ({ ...prev, visible: true }));
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  return {
    state,
    setState,
    setVisible,
    setHtml,
    show,
    hide,
    toggle,
    reset,
  };
}
