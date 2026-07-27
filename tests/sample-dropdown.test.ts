import { describe, expect, it, vi } from "vitest";
import { createSampleDropdown } from "../src/lib/core/sampleDropdown";

describe("createSampleDropdown", () => {
  it("returns null when no samples are given", () => {
    expect(createSampleDropdown([], "Load sample data...", vi.fn())).toBeNull();
  });

  it("renders a trigger and one option per sample, menu closed", () => {
    const onSelect = vi.fn();
    const dropdown = createSampleDropdown(
      [
        { label: "Counties", url: "https://example.com/counties.fgb" },
        { label: "Buildings", url: "https://example.com/buildings.fgb" },
      ],
      "Load sample data...",
      onSelect,
    )!;

    expect(
      dropdown.querySelector(".maplibre-gl-sample-trigger-label")?.textContent,
    ).toBe("Load sample data...");
    const menu = dropdown.querySelector(
      ".maplibre-gl-sample-menu",
    ) as HTMLElement;
    expect(menu.hidden).toBe(true);
    const options = [...dropdown.querySelectorAll(".maplibre-gl-sample-option")];
    expect(options.map((o) => o.textContent)).toEqual(["Counties", "Buildings"]);
  });

  it("opens on trigger click and calls onSelect with the URL when an option is picked", () => {
    const onSelect = vi.fn();
    const dropdown = createSampleDropdown(
      [{ label: "Counties", url: "https://example.com/counties.fgb" }],
      "Load sample data...",
      onSelect,
    )!;
    document.body.appendChild(dropdown);

    const trigger = dropdown.querySelector(
      ".maplibre-gl-sample-trigger",
    ) as HTMLButtonElement;
    const menu = dropdown.querySelector(
      ".maplibre-gl-sample-menu",
    ) as HTMLElement;

    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    (
      dropdown.querySelector(".maplibre-gl-sample-option") as HTMLButtonElement
    ).click();
    // The entry travels with the URL so a control can apply its own settings.
    expect(onSelect).toHaveBeenCalledWith("https://example.com/counties.fgb", {
      label: "Counties",
      url: "https://example.com/counties.fgb",
    });
    expect(menu.hidden).toBe(true);

    dropdown.remove();
  });
});

describe("per-sample settings", () => {
  it("hands the picked entry back so a control can apply its settings", () => {
    // The URL alone is not enough: a control's `default*` options are shared by
    // every sample it offers, so the entry has to travel with it.
    const onSelect = vi.fn();
    const sample = {
      label: "Sea surface temperature",
      url: "https://example.com/sst.zarr",
      variable: "sst",
      clim: [-2, 32] as [number, number],
      colormap: ["#000000", "#ffffff"],
      selector: {},
    };
    const dropdown = createSampleDropdown([sample], "Load sample data...", onSelect)!;
    document.body.appendChild(dropdown);

    (dropdown.querySelector(".maplibre-gl-sample-trigger") as HTMLButtonElement).click();
    (dropdown.querySelector(".maplibre-gl-sample-option") as HTMLButtonElement).click();

    expect(onSelect).toHaveBeenCalledWith("https://example.com/sst.zarr", sample);
  });
});

