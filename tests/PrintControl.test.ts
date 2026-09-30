import { describe, it, expect, vi } from "vitest";
import { PrintControl } from "../src/lib/core/PrintControl";

describe("MaplibrePrintControl page-size defaults (opengeos/maplibre-gl-components#135)", () => {
  it("surfaces the size and page-option controls by default", () => {
    const control: any = new PrintControl();
    expect(control._options.showSizeOptions).toBe(true);
    expect(control._options.showPageOptions).toBe(true);
  });

  it("defaults to print-resolution 150 DPI instead of screen-resolution 96", () => {
    const control: any = new PrintControl();
    expect(control._options.dpi).toBe(150);
    expect(control._state.dpi).toBe(150);
  });

  it("ships with an A4 paper default so users get a printable sheet out of the box", () => {
    const control: any = new PrintControl();
    expect(control._options.pageSize).toBe("a4");
  });

  it("respects explicit overrides so callers can opt out of the new defaults", () => {
    const control: any = new PrintControl({
      showSizeOptions: false,
      showPageOptions: false,
      dpi: 300,
    });
    expect(control._options.showSizeOptions).toBe(false);
    expect(control._options.showPageOptions).toBe(false);
    expect(control._options.dpi).toBe(300);
    expect(control._state.dpi).toBe(300);
  });
});

describe("MaplibrePrintControl page-size geometry", () => {
  function layout(
    control: any,
    overrides: Record<string, unknown>,
    canvas = { width: 800, height: 600, getContext: () => null, toBlob: () => Promise.resolve(null) },
  ) {
    Object.assign(control._state, overrides);
    return (control as any)._getPageLayout(canvas as any) as any;
  }

  let control: any;

  it("A4 portrait at 150 DPI yields a 1241 x 1754 px sheet (8.27 x 11.69 in * 150)", () => {
    control = new PrintControl() as any;
    const l = layout(control, {
      pageSize: "a4",
      orientation: "portrait",
      dpi: 150,
      margin: 0,
    });
    expect(l.pageW).toBe(1241);
    expect(l.pageH).toBe(1754);
  });

  it("A4 landscape at 150 DPI swaps the sheet dimensions to 1754 x 1241 px", () => {
    control = new PrintControl() as any;
    const l = layout(control, {
      pageSize: "a4",
      orientation: "landscape",
      dpi: 150,
      margin: 0,
    });
    expect(l.pageW).toBe(1754);
    expect(l.pageH).toBe(1241);
  });

  it("A4 at 300 DPI produces exactly 2x the pixel count of 150 DPI (the 'low quality' fix)", () => {
    control = new PrintControl() as any;
    const low = layout(control, {
      pageSize: "a4",
      orientation: "portrait",
      dpi: 150,
      margin: 0,
    });
    const high = layout(control, {
      pageSize: "a4",
      orientation: "portrait",
      dpi: 300,
      margin: 0,
    });
    expect(high.pageW).toBeCloseTo(low.pageW * 2, -1);
    expect(high.pageH).toBeCloseTo(low.pageH * 2, -1);
  });

  it("honors a 1/3-inch page margin at 150 DPI by shrinking the drawable content rect by 50 px per side", () => {
    control = new PrintControl() as any;
    const base = layout(control, {
      pageSize: "a4",
      orientation: "portrait",
      dpi: 150,
      margin: 0,
    });
    const margin = layout(control, {
      pageSize: "a4",
      orientation: "portrait",
      dpi: 150,
      margin: 24, // 24 pt = 1/3 inch
    });
    // Page dimensions are unchanged; the *content* rect is what shrinks.
    expect(margin.pageW).toBe(base.pageW);
    expect(margin.pageH).toBe(base.pageH);
    // 1/3 in * 150 DPI = 50 px per side -> 100 px off each content dimension.
    expect(margin.content.w).toBe(base.content.w - 100);
    expect(margin.content.h).toBe(base.content.h - 100);
  });

  it("'fit' still scales from the canvas size but now multiplies by dpi/96, so it honors the default 150 DPI (800x600 -> 1250x938)", () => {
    control = new PrintControl() as any;
    const l = layout(control, {
      pageSize: "fit",
      dpi: 150,
      width: 0,
      height: 0,
    });
    // 800 * (150/96) = 1250 ; 600 * (150/96) = 937.5 -> 938
    expect(l.pageW).toBe(1250);
    expect(l.pageH).toBe(938);
  });
});
