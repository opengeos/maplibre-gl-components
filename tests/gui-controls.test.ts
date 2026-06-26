import { describe, it, expect, beforeEach, vi } from "vitest";
import { ColorbarGuiControl } from "../src/lib/core/ColorbarGuiControl";
import { LegendGuiControl } from "../src/lib/core/LegendGuiControl";
import { HtmlGuiControl } from "../src/lib/core/HtmlGuiControl";
import {
  PANEL_RESIZE_HANDLE_CLASS,
  PANEL_RESIZE_LEFT_CLASS,
  PANEL_RESIZE_RIGHT_CLASS,
  PANEL_MAX_HEIGHT_CEILING,
  PANEL_MIN_WIDTH,
  PANEL_MIN_HEIGHT,
} from "../src/lib/utils/panelResize";

describe("GUI controls multiple instances", () => {
  let mockMap: any;

  beforeEach(() => {
    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      getZoom: vi.fn().mockReturnValue(10),
    };
  });

  it("groups colorbars sharing a corner into a single control", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    // Both colorbars use the default corner, so they are stacked inside one
    // map control rather than two competing controls.
    expect(mockMap.addControl).toHaveBeenCalledTimes(1);
    expect(control.getState().hasColorbar).toBe(true);
    expect(control.getState().colorbars.length).toBe(2);
    const grouped = mockMap.addControl.mock.calls[0][0];
    expect(grouped.getState().colorbars.length).toBe(2);
    expect(
      container.querySelectorAll(".colorbar-gui-select")[0],
    ).toBeInstanceOf(HTMLSelectElement);
  });

  it("adds a separate control per corner", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const selects = container.querySelectorAll(".colorbar-gui-select");
    const positionSelect = selects[3] as HTMLSelectElement;
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    positionSelect.value = "top-left";
    positionSelect.dispatchEvent(new Event("change"));
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().colorbars.length).toBe(2);
  });

  it("keeps a colorbar's place in the stack when it is updated", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const selects = container.querySelectorAll(".colorbar-gui-select");
    const colorbarSelect = selects[0] as HTMLSelectElement;
    const colormapSelect = selects[1] as HTMLSelectElement;
    // Inputs in panel order: min, max, label, units.
    const labelInput = container.querySelectorAll(".colorbar-gui-input")[2] as HTMLInputElement;
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;
    const updateButton = container.querySelectorAll(
      ".colorbar-gui-add-btn",
    )[1] as HTMLButtonElement;

    const addNamed = (label: string) => {
      colorbarSelect.value = "-1";
      colorbarSelect.dispatchEvent(new Event("change"));
      labelInput.value = label;
      labelInput.dispatchEvent(new Event("input"));
      addButton.click();
    };
    addNamed("Depth");
    addNamed("Weight");
    addNamed("Height");

    const grouped = mockMap.addControl.mock.calls[0][0];
    const labelsBefore = control
      .getState()
      .colorbars.map((c) => c.label);
    expect(labelsBefore).toEqual(["Depth", "Weight", "Height"]);

    // Select the first colorbar and update its colormap.
    colorbarSelect.value = "0";
    colorbarSelect.dispatchEvent(new Event("change"));
    colormapSelect.value = "plasma";
    colormapSelect.dispatchEvent(new Event("change"));
    updateButton.click();

    // No new control is added (the grouped control is updated in place) and
    // the stacking order is unchanged.
    expect(mockMap.addControl).toHaveBeenCalledTimes(1);
    expect(control.getState().colorbars.map((c) => c.label)).toEqual([
      "Depth",
      "Weight",
      "Height",
    ]);
    expect(control.getState().colorbars[0].colormap).toBe("plasma");
    expect(grouped.getState().colorbars.length).toBe(3);
  });

  it("applies the stacking direction to the grouped control", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;
    addButton.click();
    addButton.click();

    const grouped = mockMap.addControl.mock.calls[0][0];
    const groupContainer = grouped.onAdd(mockMap);
    expect(groupContainer.style.flexDirection).toBe("column");

    // Selects, in panel order: colorbar, colormap, orientation, position,
    // stack. The stack select is the last one.
    const selects = container.querySelectorAll(".colorbar-gui-select");
    const stackSelect = selects[selects.length - 1] as HTMLSelectElement;
    expect(stackSelect.querySelector('option[value="horizontal"]')).not.toBeNull();
    stackSelect.value = "horizontal";
    stackSelect.dispatchEvent(new Event("change"));

    expect(control.getState().stackOrientation).toBe("horizontal");
    expect(groupContainer.style.flexDirection).toBe("row");
  });

  it("should not update an existing colorbar while editing a new colorbar draft", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const selects = container.querySelectorAll(".colorbar-gui-select");
    const colorbarSelect = selects[0] as HTMLSelectElement;
    const colormapSelect = selects[1] as HTMLSelectElement;
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    colorbarSelect.value = "-1";
    colorbarSelect.dispatchEvent(new Event("change"));
    colormapSelect.value = "plasma";
    colormapSelect.dispatchEvent(new Event("change"));

    expect(mockMap.addControl).toHaveBeenCalledTimes(1);
    expect(mockMap.removeControl).not.toHaveBeenCalled();
    expect(control.getState().colorbars[0].colormap).toBe("viridis");

    addButton.click();

    // Both colorbars share the default corner, so they live in one grouped
    // control (addControl is only called when the corner is first occupied).
    expect(mockMap.addControl).toHaveBeenCalledTimes(1);
    expect(control.getState().colorbars[1].colormap).toBe("plasma");
  });

  it("should restore colorbars from saved GUI state", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const selects = container.querySelectorAll(".colorbar-gui-select");
    const colorbarSelect = selects[0] as HTMLSelectElement;
    const colormapSelect = selects[1] as HTMLSelectElement;
    const addButton = container.querySelector(
      ".colorbar-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    colorbarSelect.value = "-1";
    colorbarSelect.dispatchEvent(new Event("change"));
    colormapSelect.value = "plasma";
    colormapSelect.dispatchEvent(new Event("change"));
    addButton.click();
    const savedState = control.getState();

    const restoredMap = {
      ...mockMap,
      addControl: vi.fn(),
      removeControl: vi.fn(),
    };
    const restored = new ColorbarGuiControl();
    restored.onAdd(restoredMap);
    restored.setState(savedState);

    // Two saved colorbars at the same corner restore into one grouped control.
    expect(restoredMap.addControl).toHaveBeenCalledTimes(1);
    expect(restored.getState().colorbars).toEqual(savedState.colorbars);
    expect(restored.getState().selectedColorbarIndex).toBe(1);
  });

  it("should add multiple legends from the legend GUI", () => {
    const control = new LegendGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      ".legend-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().hasLegend).toBe(true);
    expect(control.getState().legends.length).toBe(2);
  });

  it("should restore legends from saved GUI state", () => {
    const control = new LegendGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const titleInput = container.querySelector(
      ".legend-gui-input",
    ) as HTMLInputElement;
    const addButton = container.querySelector(
      ".legend-gui-add-btn",
    ) as HTMLButtonElement;

    titleInput.value = "Land cover";
    titleInput.dispatchEvent(new Event("input"));
    addButton.click();
    const savedState = control.getState();

    const restoredMap = {
      ...mockMap,
      addControl: vi.fn(),
      removeControl: vi.fn(),
    };
    const restored = new LegendGuiControl();
    restored.onAdd(restoredMap);
    restored.setState(savedState);

    expect(restoredMap.addControl).toHaveBeenCalledTimes(1);
    expect(restored.getState().legends).toEqual(savedState.legends);
    expect(restored.getState().title).toBe("Land cover");
  });

  it("sizes the legend panel to the available viewport height by default", () => {
    const control = new LegendGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".legend-gui-panel") as HTMLElement;

    // top is 0 in jsdom, so the panel may use the full viewport (minus margin).
    expect(panel.style.maxHeight).toBe(`${window.innerHeight - 16}px`);
    expect(panel.style.overflowY).toBe("auto");
  });

  it("treats an explicit legend maxHeight as an upper bound", () => {
    const control = new LegendGuiControl({ collapsed: false, maxHeight: 300 });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".legend-gui-panel") as HTMLElement;

    expect(panel.style.maxHeight).toBe("300px");
  });

  it("sizes the colorbar panel to the available space by default", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".colorbar-gui-panel") as HTMLElement;

    // No map container in the mock, so the cap is the hard ceiling clamped to
    // the viewport (minus the edge margin). The panel itself never scrolls; its
    // inner body does.
    const expected = Math.min(PANEL_MAX_HEIGHT_CEILING, window.innerHeight - 12);
    expect(panel.style.maxHeight).toBe(`${expected}px`);
    expect(panel.style.overflowY).toBe("hidden");
    const body = panel.querySelector(".maplibre-gl-panel-body") as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.style.overflowY).toBe("auto");
  });

  it("re-sizes the colorbar panel when the window is resized", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".colorbar-gui-panel") as HTMLElement;

    const original = window.innerHeight;
    try {
      // A short viewport (below the ceiling) so the cap tracks it dynamically.
      Object.defineProperty(window, "innerHeight", {
        value: 400,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
      expect(panel.style.maxHeight).toBe(`${400 - 12}px`);
    } finally {
      Object.defineProperty(window, "innerHeight", {
        value: original,
        configurable: true,
      });
    }
  });

  it("renders both bottom-corner resize grips on the colorbar panel", () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".colorbar-gui-panel") as HTMLElement;

    expect(
      panel.querySelectorAll(`.${PANEL_RESIZE_HANDLE_CLASS}`).length,
    ).toBe(2);
    expect(panel.querySelector(`.${PANEL_RESIZE_LEFT_CLASS}`)).not.toBeNull();
    expect(panel.querySelector(`.${PANEL_RESIZE_RIGHT_CLASS}`)).not.toBeNull();
    // The float-beside-button layout (position: absolute) is preserved so the
    // grips anchor to the panel and width grows toward the map interior rather
    // than the panel collapsing into normal flow.
    expect(panel.style.position).toBe("absolute");
  });

  it("does not duplicate the colorbar grips when re-shown in place", () => {
    const control = new ColorbarGuiControl({ collapsed: false }) as any;
    const container = control.onAdd(mockMap);
    // The panel persists across shows while open, so _showPanel must not append
    // a second pair of grips.
    control._showPanel();
    control._showPanel();
    const panel = container.querySelector(".colorbar-gui-panel") as HTMLElement;
    expect(
      panel.querySelectorAll(`.${PANEL_RESIZE_HANDLE_CLASS}`).length,
    ).toBe(2);
  });

  it("re-applies a persisted colorbar panel size across collapse/expand", () => {
    const control = new ColorbarGuiControl({ collapsed: false }) as any;
    const container = control.onAdd(mockMap);
    control._userPanelSize = {
      width: PANEL_MIN_WIDTH + 40,
      height: PANEL_MIN_HEIGHT + 70,
    };
    control.collapse();
    control.expand();
    const panel = container.querySelector(".colorbar-gui-panel") as HTMLElement;
    expect(panel.style.width).toBe(`${PANEL_MIN_WIDTH + 40}px`);
    expect(panel.style.height).toBe(`${PANEL_MIN_HEIGHT + 70}px`);
  });

  it("removes the resize listener when the panel is collapsed", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const control = new ColorbarGuiControl({ collapsed: false });
    control.onAdd(mockMap);
    control.collapse();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("should add multiple HTML controls from the HTML GUI", () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      ".html-gui-add-btn",
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().hasHtmlControl).toBe(true);
    expect(control.getState().htmls.length).toBe(2);
  });

  it("should restore HTML controls from saved GUI state", () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const titleInput = container.querySelector(
      ".html-gui-input",
    ) as HTMLInputElement;
    const htmlTextarea = container.querySelector(
      ".html-gui-textarea",
    ) as HTMLTextAreaElement;
    const addButton = container.querySelector(
      ".html-gui-add-btn",
    ) as HTMLButtonElement;

    titleInput.value = "Summary";
    titleInput.dispatchEvent(new Event("input"));
    htmlTextarea.value = "<strong>Restored</strong>";
    htmlTextarea.dispatchEvent(new Event("input"));
    addButton.click();
    const savedState = control.getState();

    const restoredMap = {
      ...mockMap,
      addControl: vi.fn(),
      removeControl: vi.fn(),
    };
    const restored = new HtmlGuiControl();
    restored.onAdd(restoredMap);
    restored.setState(savedState);

    expect(restoredMap.addControl).toHaveBeenCalledTimes(1);
    expect(restored.getState().htmls).toEqual(savedState.htmls);
    expect(restored.getState().html).toBe("<strong>Restored</strong>");
  });

  it("sizes the HTML panel to the available space by default (no fixed cap)", () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;

    // No map container in the mock, so the cap is the hard ceiling clamped to
    // the viewport (minus the edge margin) instead of a fixed 500px that would
    // scroll while space remains below it. The panel itself never scrolls; its
    // inner body does.
    const expected = Math.min(PANEL_MAX_HEIGHT_CEILING, window.innerHeight - 12);
    expect(panel.style.maxHeight).toBe(`${expected}px`);
    expect(panel.style.overflowY).toBe("hidden");
    const body = panel.querySelector(".maplibre-gl-panel-body") as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.style.overflowY).toBe("auto");
  });

  it("treats an explicit HTML maxHeight as an upper bound", () => {
    const control = new HtmlGuiControl({ collapsed: false, maxHeight: 300 });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;

    expect(panel.style.maxHeight).toBe("300px");
  });

  it("re-sizes the HTML panel when the window is resized", () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;

    const original = window.innerHeight;
    try {
      // A short viewport (below the ceiling) so the cap tracks it dynamically.
      Object.defineProperty(window, "innerHeight", {
        value: 400,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
      expect(panel.style.maxHeight).toBe(`${400 - 12}px`);
    } finally {
      Object.defineProperty(window, "innerHeight", {
        value: original,
        configurable: true,
      });
    }
  });

  it("renders both bottom-corner resize grips on the HTML panel", () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;

    expect(
      panel.querySelectorAll(`.${PANEL_RESIZE_HANDLE_CLASS}`).length,
    ).toBe(2);
    expect(panel.querySelector(`.${PANEL_RESIZE_LEFT_CLASS}`)).not.toBeNull();
    expect(panel.querySelector(`.${PANEL_RESIZE_RIGHT_CLASS}`)).not.toBeNull();
    // The float-beside-button layout (position: absolute) is preserved so the
    // grips anchor to the panel without it collapsing into normal flow.
    expect(panel.style.position).toBe("absolute");
  });

  it("does not duplicate the grips when the panel is re-shown in place", () => {
    const control = new HtmlGuiControl({ collapsed: false }) as any;
    const container = control.onAdd(mockMap);
    // The panel persists across shows (fields update in place); re-running
    // _showPanel must not append a second pair of grips.
    control._showPanel();
    control._showPanel();
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;
    expect(
      panel.querySelectorAll(`.${PANEL_RESIZE_HANDLE_CLASS}`).length,
    ).toBe(2);
  });

  it("re-applies a persisted user size across collapse/expand", () => {
    const control = new HtmlGuiControl({ collapsed: false }) as any;
    const container = control.onAdd(mockMap);
    control._userPanelSize = {
      width: PANEL_MIN_WIDTH + 60,
      height: PANEL_MIN_HEIGHT + 90,
    };
    control.collapse();
    control.expand();
    const panel = container.querySelector(".html-gui-panel") as HTMLElement;
    expect(panel.style.width).toBe(`${PANEL_MIN_WIDTH + 60}px`);
    expect(panel.style.height).toBe(`${PANEL_MIN_HEIGHT + 90}px`);
  });

  it("removes the HTML resize listener when the panel is collapsed", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const control = new HtmlGuiControl({ collapsed: false });
    control.onAdd(mockMap);
    control.collapse();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeSpy.mockRestore();
  });
});
