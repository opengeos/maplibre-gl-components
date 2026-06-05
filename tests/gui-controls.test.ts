import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorbarGuiControl } from '../src/lib/core/ColorbarGuiControl';
import { LegendGuiControl } from '../src/lib/core/LegendGuiControl';
import { HtmlGuiControl } from '../src/lib/core/HtmlGuiControl';

describe('GUI controls multiple instances', () => {
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

  it('should add multiple colorbars from the colorbar GUI', () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      '.colorbar-gui-add-btn'
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().hasColorbar).toBe(true);
    expect(control.getState().colorbars.length).toBe(2);
    expect(
      container.querySelectorAll('.colorbar-gui-select')[0]
    ).toBeInstanceOf(HTMLSelectElement);
  });

  it('should not update an existing colorbar while editing a new colorbar draft', () => {
    const control = new ColorbarGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const selects = container.querySelectorAll('.colorbar-gui-select');
    const colorbarSelect = selects[0] as HTMLSelectElement;
    const colormapSelect = selects[1] as HTMLSelectElement;
    const addButton = container.querySelector(
      '.colorbar-gui-add-btn'
    ) as HTMLButtonElement;

    addButton.click();
    colorbarSelect.value = '-1';
    colorbarSelect.dispatchEvent(new Event('change'));
    colormapSelect.value = 'plasma';
    colormapSelect.dispatchEvent(new Event('change'));

    expect(mockMap.addControl).toHaveBeenCalledTimes(1);
    expect(mockMap.removeControl).not.toHaveBeenCalled();
    expect(control.getState().colorbars[0].colormap).toBe('viridis');

    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().colorbars[1].colormap).toBe('plasma');
  });

  it('should add multiple legends from the legend GUI', () => {
    const control = new LegendGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      '.legend-gui-add-btn'
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().hasLegend).toBe(true);
    expect(control.getState().legends.length).toBe(2);
  });

  it('should add multiple HTML controls from the HTML GUI', () => {
    const control = new HtmlGuiControl({ collapsed: false });
    const container = control.onAdd(mockMap);
    const addButton = container.querySelector(
      '.html-gui-add-btn'
    ) as HTMLButtonElement;

    addButton.click();
    addButton.click();

    expect(mockMap.addControl).toHaveBeenCalledTimes(2);
    expect(control.getState().hasHtmlControl).toBe(true);
    expect(control.getState().htmls.length).toBe(2);
  });
});
