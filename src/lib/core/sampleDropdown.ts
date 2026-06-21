/**
 * Shared "Load sample data" dropdown used by the Add data controls
 * (AddVector, PMTiles, Zarr). A custom (not native `<select>`) dropdown so the
 * menu themes correctly in dark mode. Picking an entry calls `onSelect` with
 * its URL.
 */

/** A named sample dataset offered as a one-click entry in the dropdown. */
export interface MaplibreSampleDataset {
  /** Label shown in the dropdown. */
  label: string;
  /** URL filled into the input when this entry is picked. */
  url: string;
}

/**
 * Builds the dropdown element, or returns null when no samples are given.
 *
 * @param samples - The named sample datasets to offer.
 * @param placeholder - Trigger placeholder text shown before a selection.
 * @param onSelect - Called with the chosen sample's URL.
 * @returns The dropdown element, or null when `samples` is empty.
 */
export function createSampleDropdown(
  samples: MaplibreSampleDataset[],
  placeholder: string,
  onSelect: (url: string) => void,
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
      onSelect(sample.url);
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
