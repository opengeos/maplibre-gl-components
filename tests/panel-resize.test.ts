import { describe, it, expect, beforeEach, vi } from "vitest";
import { PMTilesLayerControl } from "../src/lib/core/PMTilesLayer";
import { ZarrLayerControl } from "../src/lib/core/ZarrLayer";
import { AddVectorControl } from "../src/lib/core/AddVector";
import {
  PANEL_RESIZE_HANDLE_CLASS,
  PANEL_RESIZE_LEFT_CLASS,
  PANEL_RESIZE_RIGHT_CLASS,
  PANEL_MIN_WIDTH,
  PANEL_MIN_HEIGHT,
  applyPanelMaxHeight,
} from "../src/lib/utils/panelResize";

/**
 * Builds a minimal mocked MapLibre map sufficient for these controls' onAdd.
 */
function makeMockMap() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    getZoom: vi.fn().mockReturnValue(4),
    isStyleLoaded: vi.fn().mockReturnValue(false),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn(),
    getSource: vi.fn(),
    triggerRepaint: vi.fn(),
    // No getContainer: the helper falls back to the viewport, which is fine here.
  } as any;
}

describe("panel resize handle", () => {
  const cases: { name: string; make: () => any; panelClass: string }[] = [
    {
      name: "PMTilesLayerControl",
      make: () => new PMTilesLayerControl({ collapsed: false }),
      panelClass: ".maplibre-gl-pmtiles-layer-panel",
    },
    {
      name: "ZarrLayerControl",
      make: () => new ZarrLayerControl({ collapsed: false }),
      panelClass: ".maplibre-gl-zarr-layer-panel",
    },
    {
      name: "AddVectorControl",
      make: () => new AddVectorControl({ collapsed: false }),
      panelClass: ".maplibre-gl-add-vector-panel",
    },
  ];

  for (const c of cases) {
    describe(c.name, () => {
      let control: any;
      let container: HTMLElement;

      beforeEach(() => {
        control = c.make();
        container = control.onAdd(makeMockMap());
        document.body.appendChild(container);
      });

      it("renders both bottom-corner resize grips in the expanded panel", () => {
        const handles = container.querySelectorAll(
          `.${PANEL_RESIZE_HANDLE_CLASS}`,
        );
        expect(handles.length).toBe(2);
        expect(
          container.querySelector(`.${PANEL_RESIZE_LEFT_CLASS}`),
        ).not.toBeNull();
        expect(
          container.querySelector(`.${PANEL_RESIZE_RIGHT_CLASS}`),
        ).not.toBeNull();
      });

      it("places both grips inside the panel", () => {
        const panel = container.querySelector(c.panelClass) as HTMLElement;
        expect(panel).not.toBeNull();
        const left = panel.querySelector(`.${PANEL_RESIZE_LEFT_CLASS}`);
        const right = panel.querySelector(`.${PANEL_RESIZE_RIGHT_CLASS}`);
        expect(left).not.toBeNull();
        expect(right).not.toBeNull();
        // The panel must be a positioned ancestor so the grips pin to it.
        expect(panel.style.position).toBe("relative");
      });

      it("drives a dynamic max-height instead of a fixed cap", () => {
        const panel = container.querySelector(c.panelClass) as HTMLElement;
        // A dynamic length cap (jsdom normalizes the min() to a calc()), not
        // the old fixed "500px", and a reserved scrollbar gutter.
        expect(panel.style.maxHeight).not.toBe("500px");
        expect(panel.style.maxHeight).toMatch(/px/);
        expect(panel.style.overflowY).toBe("auto");
        expect(panel.style.scrollbarGutter).toBe("stable");
      });

      it("resizes via width/height on drag without switching to position: fixed", () => {
        // Dock the control top-left so growing the panel means dragging the
        // bottom-right interior corner right and down.
        const ctrlWrap = document.createElement("div");
        ctrlWrap.className = "maplibregl-ctrl-top-left";
        document.body.appendChild(ctrlWrap);
        ctrlWrap.appendChild(container);

        const panel = container.querySelector(c.panelClass) as HTMLElement;
        const right = panel.querySelector(
          `.${PANEL_RESIZE_RIGHT_CLASS}`,
        ) as HTMLElement;
        // Stub the geometry jsdom does not compute so the dock-based math has
        // real numbers to work with: the panel is docked at the top-left.
        panel.getBoundingClientRect = () =>
          ({ left: 10, top: 10, right: 310, bottom: 210, width: 300, height: 200 }) as DOMRect;

        const down = new Event("pointerdown") as any;
        down.clientX = 310;
        down.clientY = 210;
        down.pointerId = 1;
        right.dispatchEvent(down);

        const move = new Event("pointermove") as any;
        move.clientX = 460; // drag the interior corner 150px right
        move.clientY = 360; // and 150px down
        right.dispatchEvent(move);

        // The drag must resize, not reposition: no position: fixed, and the
        // docked edges (left/top/right/bottom) are untouched.
        expect(panel.style.position).toBe("relative");
        expect(panel.style.left).toBe("");
        expect(panel.style.top).toBe("");
        expect(panel.style.right).toBe("");
        expect(panel.style.bottom).toBe("");
        expect(parseFloat(panel.style.width)).toBeGreaterThan(300);
        expect(parseFloat(panel.style.height)).toBeGreaterThan(200);

        const up = new Event("pointerup") as any;
        up.pointerId = 1;
        right.dispatchEvent(up);

        // Still no fixed positioning after release.
        expect(panel.style.position).toBe("relative");
      });

      it("re-applies a persisted user size across re-renders", () => {
        const panel = container.querySelector(c.panelClass) as HTMLElement;
        // Simulate a user-resized panel by writing the private size field.
        control._userPanelSize = {
          width: PANEL_MIN_WIDTH + 80,
          height: PANEL_MIN_HEIGHT + 120,
        };
        // Force a re-render (collapse/expand cycle keeps the instance size).
        control.collapse();
        control.expand();
        const newPanel = container.querySelector(c.panelClass) as HTMLElement;
        expect(newPanel.style.width).toBe(`${PANEL_MIN_WIDTH + 80}px`);
        expect(newPanel.style.height).toBe(`${PANEL_MIN_HEIGHT + 120}px`);
      });
    });
  }
});

describe("applyPanelMaxHeight", () => {
  it("caps the panel height to the available space with a scrollbar gutter", () => {
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    applyPanelMaxHeight(panel, undefined, undefined);
    // A dynamic length cap (jsdom normalizes the min() to a calc()).
    expect(panel.style.maxHeight).toMatch(/px/);
    expect(panel.style.maxHeight).not.toBe("");
    expect(panel.style.overflowY).toBe("auto");
    expect(panel.style.scrollbarGutter).toBe("stable");
  });
});
