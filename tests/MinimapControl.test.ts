import { describe, it, expect, beforeEach, vi } from "vitest";
import { MinimapControl } from "../src/lib/core/MinimapControl";

describe("MinimapControl", () => {
  let control: MinimapControl;
  let mockMap: any;

  beforeEach(() => {
    control = new MinimapControl();

    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      getZoom: vi.fn().mockReturnValue(10),
      getCenter: vi.fn().mockReturnValue({ lng: 0, lat: 0 }),
      getBounds: vi.fn().mockReturnValue({
        getSouthWest: () => ({ lng: -1, lat: -1 }),
        getNorthEast: () => ({ lng: 1, lat: 1 }),
        getNorthWest: () => ({ lng: -1, lat: 1 }),
        getSouthEast: () => ({ lng: 1, lat: -1 }),
      }),
    };
  });

  describe("constructor", () => {
    it("should create control with default options", () => {
      const state = control.getState();
      expect(state.visible).toBe(true);
      expect(state.collapsed).toBe(false);
    });

    it("should create control with custom options", () => {
      const ctrl = new MinimapControl({
        collapsed: true,
        width: 200,
        height: 150,
        zoomOffset: -3,
      });
      const state = ctrl.getState();
      expect(state.collapsed).toBe(true);
    });
  });

  describe("onAdd", () => {
    it("should create and return container element", () => {
      const container = control.onAdd(mockMap);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.classList.contains("maplibregl-ctrl")).toBe(true);
      expect(
        container.classList.contains("maplibre-gl-minimap-control"),
      ).toBe(true);
    });

    it("should have a toggle button", () => {
      const container = control.onAdd(mockMap);
      const button = container.querySelector(".minimap-button");
      expect(button).not.toBeNull();
    });
  });

  describe("show/hide", () => {
    it("should show the control", () => {
      const ctrl = new MinimapControl({ visible: false, collapsed: true });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().visible).toBe(false);
      ctrl.show();
      expect(ctrl.getState().visible).toBe(true);
    });

    it("should hide the control", () => {
      const ctrl = new MinimapControl({ collapsed: true });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().visible).toBe(true);
      ctrl.hide();
      expect(ctrl.getState().visible).toBe(false);
    });
  });

  describe("collapse/expand", () => {
    it("should collapse the minimap", () => {
      const ctrl = new MinimapControl({ collapsed: false });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().collapsed).toBe(false);
      ctrl.collapse();
      expect(ctrl.getState().collapsed).toBe(true);
    });

    it("should expand the minimap", () => {
      const ctrl = new MinimapControl({ collapsed: true });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().collapsed).toBe(true);
      ctrl.expand();
      expect(ctrl.getState().collapsed).toBe(false);
    });

    it("should toggle the collapsed state", () => {
      const ctrl = new MinimapControl({ collapsed: true });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().collapsed).toBe(true);
      ctrl.toggle();
      expect(ctrl.getState().collapsed).toBe(false);
      ctrl.toggle();
      expect(ctrl.getState().collapsed).toBe(true);
    });
  });

  describe("events", () => {
    it("should register and trigger event handlers", () => {
      const handler = vi.fn();
      control.on("show", handler);
      control.onAdd(mockMap);

      control.show();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "show" }),
      );
    });

    it("should emit expand/collapse events", () => {
      const expandHandler = vi.fn();
      const collapseHandler = vi.fn();
      const ctrl = new MinimapControl({ collapsed: true });
      ctrl.on("expand", expandHandler);
      ctrl.on("collapse", collapseHandler);
      ctrl.onAdd(mockMap);

      ctrl.expand();
      expect(expandHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "expand" }),
      );

      ctrl.collapse();
      expect(collapseHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "collapse" }),
      );
    });

    it("should remove event handler with off", () => {
      const handler = vi.fn();
      control.on("show", handler);
      control.off("show", handler);
      control.onAdd(mockMap);

      control.show();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("chainable API", () => {
    it("should return this for chaining", () => {
      const ctrl = new MinimapControl({ collapsed: true });
      ctrl.onAdd(mockMap);

      expect(ctrl.show()).toBe(ctrl);
      expect(ctrl.hide()).toBe(ctrl);
      expect(ctrl.expand()).toBe(ctrl);
      expect(ctrl.collapse()).toBe(ctrl);
      expect(ctrl.toggle()).toBe(ctrl);
    });
  });

  describe("onRemove", () => {
    it("should clean up on remove", () => {
      const ctrl = new MinimapControl({ collapsed: true });
      const container = ctrl.onAdd(mockMap);
      const parent = document.createElement("div");
      parent.appendChild(container);

      ctrl.onRemove();
      expect(parent.children.length).toBe(0);
    });
  });
});
