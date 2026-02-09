import { describe, it, expect, beforeEach, vi } from "vitest";
import { TimeSliderControl } from "../src/lib/core/TimeSliderControl";

describe("TimeSliderControl", () => {
  let control: TimeSliderControl;
  let mockMap: any;

  beforeEach(() => {
    control = new TimeSliderControl({ min: 0, max: 100 });

    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      getZoom: vi.fn().mockReturnValue(10),
    };
  });

  describe("constructor", () => {
    it("should create control with default options", () => {
      const state = control.getState();
      expect(state.visible).toBe(true);
      expect(state.collapsed).toBe(true);
      expect(state.value).toBe(0);
      expect(state.playing).toBe(false);
      expect(state.min).toBe(0);
      expect(state.max).toBe(100);
    });

    it("should create control with custom options", () => {
      const ctrl = new TimeSliderControl({
        min: 10,
        max: 50,
        value: 25,
        collapsed: false,
      });
      const state = ctrl.getState();
      expect(state.value).toBe(25);
      expect(state.min).toBe(10);
      expect(state.max).toBe(50);
      expect(state.collapsed).toBe(false);
    });

    it("should handle discrete values", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 100,
        values: ["a", "b", "c", "d"],
      });
      const state = ctrl.getState();
      expect(state.min).toBe(0);
      expect(state.max).toBe(3);
    });
  });

  describe("onAdd", () => {
    it("should create and return container element", () => {
      const container = control.onAdd(mockMap);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.classList.contains("maplibregl-ctrl")).toBe(true);
      expect(
        container.classList.contains("maplibre-gl-time-slider-control"),
      ).toBe(true);
    });

    it("should have a toggle button", () => {
      const container = control.onAdd(mockMap);
      const button = container.querySelector(".time-slider-button");
      expect(button).not.toBeNull();
    });
  });

  describe("show/hide", () => {
    it("should show the control", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 100,
        visible: false,
      });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().visible).toBe(false);
      ctrl.show();
      expect(ctrl.getState().visible).toBe(true);
    });

    it("should hide the control", () => {
      control.onAdd(mockMap);

      expect(control.getState().visible).toBe(true);
      control.hide();
      expect(control.getState().visible).toBe(false);
    });
  });

  describe("collapse/expand", () => {
    it("should expand the panel", () => {
      control.onAdd(mockMap);

      expect(control.getState().collapsed).toBe(true);
      control.expand();
      expect(control.getState().collapsed).toBe(false);
    });

    it("should collapse the panel", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 100,
        collapsed: false,
      });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().collapsed).toBe(false);
      ctrl.collapse();
      expect(ctrl.getState().collapsed).toBe(true);
    });

    it("should toggle the collapsed state", () => {
      control.onAdd(mockMap);

      expect(control.getState().collapsed).toBe(true);
      control.toggle();
      expect(control.getState().collapsed).toBe(false);
      control.toggle();
      expect(control.getState().collapsed).toBe(true);
    });
  });

  describe("play/pause", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should start playback", () => {
      control.onAdd(mockMap);
      control.expand();

      control.play();
      expect(control.getState().playing).toBe(true);
    });

    it("should pause playback", () => {
      control.onAdd(mockMap);
      control.expand();

      control.play();
      control.pause();
      expect(control.getState().playing).toBe(false);
    });

    it("should increment value during playback", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 10,
        step: 1,
        fps: 1,
      });
      ctrl.onAdd(mockMap);
      ctrl.expand();

      ctrl.play();
      vi.advanceTimersByTime(1000);
      expect(ctrl.getState().value).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(ctrl.getState().value).toBe(2);

      ctrl.pause();
    });

    it("should loop when reaching max", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 2,
        step: 1,
        fps: 1,
        loop: true,
      });
      ctrl.onAdd(mockMap);
      ctrl.expand();

      ctrl.play();
      vi.advanceTimersByTime(1000);
      expect(ctrl.getState().value).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(ctrl.getState().value).toBe(2);
      vi.advanceTimersByTime(1000);
      expect(ctrl.getState().value).toBe(0); // looped

      ctrl.pause();
    });

    it("should stop when reaching max without loop", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 2,
        step: 1,
        fps: 1,
        loop: false,
      });
      ctrl.onAdd(mockMap);
      ctrl.expand();

      ctrl.play();
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000); // exceeds max
      expect(ctrl.getState().playing).toBe(false);
    });
  });

  describe("setValue", () => {
    it("should set value", () => {
      control.onAdd(mockMap);
      control.expand();

      control.setValue(50);
      expect(control.getState().value).toBe(50);
    });

    it("should clamp value to range", () => {
      control.onAdd(mockMap);
      control.expand();

      control.setValue(200);
      expect(control.getState().value).toBe(100);

      control.setValue(-10);
      expect(control.getState().value).toBe(0);
    });
  });

  describe("getValue", () => {
    it("should return current value", () => {
      control.onAdd(mockMap);
      control.expand();

      control.setValue(42);
      expect(control.getValue()).toBe(42);
    });

    it("should return discrete value when using values array", () => {
      const ctrl = new TimeSliderControl({
        min: 0,
        max: 100,
        values: ["jan", "feb", "mar"],
      });
      ctrl.onAdd(mockMap);
      ctrl.expand();

      ctrl.setValue("feb");
      expect(ctrl.getValue()).toBe("feb");
    });
  });

  describe("date mode", () => {
    it("should handle Date values", () => {
      const ctrl = new TimeSliderControl({
        min: new Date("2024-01-01"),
        max: new Date("2024-12-31"),
        step: 86400000,
      });
      const state = ctrl.getState();
      expect(state.min).toBe(new Date("2024-01-01").getTime());
      expect(state.max).toBe(new Date("2024-12-31").getTime());
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

    it("should emit change event on setValue", () => {
      const handler = vi.fn();
      control.on("change", handler);
      control.onAdd(mockMap);
      control.expand();

      control.setValue(50);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "change", value: 50 }),
      );
    });

    it("should emit play/pause events", () => {
      vi.useFakeTimers();
      const playHandler = vi.fn();
      const pauseHandler = vi.fn();
      control.on("play", playHandler);
      control.on("pause", pauseHandler);
      control.onAdd(mockMap);
      control.expand();

      control.play();
      expect(playHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "play" }),
      );

      control.pause();
      expect(pauseHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "pause" }),
      );
      vi.useRealTimers();
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
      control.onAdd(mockMap);

      expect(control.show()).toBe(control);
      expect(control.hide()).toBe(control);
      expect(control.expand()).toBe(control);
      expect(control.collapse()).toBe(control);
      expect(control.toggle()).toBe(control);
      expect(control.setValue(50)).toBe(control);
      expect(control.setFps(2)).toBe(control);
    });
  });

  describe("setFps", () => {
    it("should update fps", () => {
      control.onAdd(mockMap);
      expect(control.setFps(5)).toBe(control);
    });
  });

  describe("onRemove", () => {
    it("should clean up on remove", () => {
      vi.useFakeTimers();
      const container = control.onAdd(mockMap);
      const parent = document.createElement("div");
      parent.appendChild(container);
      control.expand();
      control.play();

      control.onRemove();
      expect(parent.children.length).toBe(0);
      expect(control.getState().playing).toBe(false);
      vi.useRealTimers();
    });
  });
});
