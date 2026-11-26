import type { GuiOutputStyle } from "../core/types";

/**
 * Keep only the output style fields that are set, so spreading the result
 * over an output's options never replaces a default with `undefined`.
 *
 * @param style - The style to clean, if any.
 * @returns A new style holding only the defined fields.
 */
export function definedOutputStyle(style?: GuiOutputStyle): GuiOutputStyle {
  const result: GuiOutputStyle = {};
  if (style?.backgroundColor !== undefined) {
    result.backgroundColor = style.backgroundColor;
  }
  if (style?.fontColor !== undefined) result.fontColor = style.fontColor;
  return result;
}
