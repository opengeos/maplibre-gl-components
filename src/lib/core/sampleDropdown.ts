/**
 * Shared "Load sample data" dropdown used by the Add data controls
 * (AddVector, PMTiles, Zarr). A custom (not native `<select>`) dropdown so the
 * menu themes correctly in dark mode. Picking an entry calls `onSelect` with
 * its URL.
 */

/**
 * A named sample dataset offered as a one-click entry in the dropdown.
 *
 * Beyond the URL, an entry may carry the settings that sample needs to render
 * sensibly. A control's own `default*` options apply to every sample it offers,
 * so without these a second sample inherits the first one's variable and color
 * limits and lands looking broken -- a sea-surface-temperature cube drawn
 * against a 0-300 ramp is a flat wash. Each control applies the fields it
 * understands and ignores the rest.
 */
export interface MaplibreSampleDataset {
  /** Label shown in the dropdown. */
  label: string;
  /** URL filled into the input when this entry is picked. */
  url: string;
  /** Array/variable to select for this sample (Zarr). */
  variable?: string;
  /** Color limits `[min, max]` to apply for this sample (Zarr). */
  clim?: [number, number];
  /** Colormap stops to apply for this sample (Zarr). */
  colormap?: string[];
  /**
   * Dimension selector to apply for this sample (Zarr). Pass `{}` to clear a
   * selector left over from another sample whose dimensions this store lacks.
   */
  selector?: Record<string, number | string>;
}

/**
 * Builds the dropdown element, or returns null when no samples are given.
 *
 * @param samples - The named sample datasets to offer.
 * @param placeholder - Trigger placeholder text shown before a selection.
 * @param onSelect - Called with the chosen sample's URL and the entry itself,
 *   so a control can also apply that sample's own settings.
 * @returns The dropdown element, or null when `samples` is empty.
 */
export function createSampleDropdown(
  samples: MaplibreSampleDataset[],
  placeholder: string,
  onSelect: (url: string, sample: MaplibreSampleDataset) => void,
): HTMLElement | null {
  if (samples.length === 0) return null;

  const triggerLabel = document.createElement("span");
  triggerLabel.className = "maplibre-gl-sample-trigger-label";
  triggerLabel.textContent = placeholder;
  const caret = document.createElement("span");
  caret.className = "maplibre-gl-sample-caret";
  caret.textContent = "▾";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "maplibre-gl-sample-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", placeholder);
  trigger.appendChild(triggerLabel);
  trigger.appendChild(caret);

  const menu = document.createElement("div");
  menu.className = "maplibre-gl-sample-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  let menuOpen = false;
  const setMenuOpen = (open: boolean): void => {
    menuOpen = open;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.classList.toggle("open", open);
    if (open) (menu.firstElementChild as HTMLElement | null)?.focus();
  };

  for (const sample of samples) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "maplibre-gl-sample-option";
    option.setAttribute("role", "option");
    option.textContent = sample.label;
    option.title = sample.url;
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenuOpen(false);
      trigger.focus();
      onSelect(sample.url, sample);
    });
    menu.appendChild(option);
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  const wrap = document.createElement("div");
  wrap.className = "maplibre-gl-sample-dropdown";
  wrap.appendChild(trigger);
  wrap.appendChild(menu);

  // Close on Escape or when focus leaves the dropdown (no document listener).
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      trigger.focus();
    }
  });
  wrap.addEventListener("focusout", (e) => {
    const next = (e as FocusEvent).relatedTarget as Node | null;
    if (!next || !wrap.contains(next)) setMenuOpen(false);
  });

  return wrap;
}
