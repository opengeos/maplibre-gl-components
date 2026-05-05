import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpinGlobeControl } from "../src/lib/core/SpinGlobeControl";

function createMockMap() {
  const handlers = new Map<string, () => void>();
  const canvas = document.createElement("canvas");
  const map = {
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
    }),
    once: vi.fn(),
    off: vi.fn(),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    getCanvas: vi.fn().mockReturnValue(canvas),
    getCenter: vi.fn().mockReturnValue({ lng: 0, lat: 0 }),
    jumpTo: vi.fn(),
  } as any;

  return { map, handlers, canvas };
}

describe("SpinGlobeControl", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stops spinning when map interaction starts", () => {
    const { map, handlers } = createMockMap();
    const control = new SpinGlobeControl();
    const onStop = vi.fn();

    control.on("spinstop", onStop);
    control.onAdd(map);
    control.startSpin();

    handlers.get("dragstart")?.();

    expect(control.isSpinning()).toBe(false);
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("registers all interaction start events that should stop spinning", () => {
    const { map } = createMockMap();
    const control = new SpinGlobeControl();

    control.onAdd(map);

    expect(map.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("rotatestart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("pitchstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("boxzoomstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("dblclick", expect.any(Function));
  });

  it("stops spinning on canvas wheel events", () => {
    const { map, canvas } = createMockMap();
    const control = new SpinGlobeControl();

    control.onAdd(map);
    control.startSpin();
    canvas.dispatchEvent(new WheelEvent("wheel"));

    expect(control.isSpinning()).toBe(false);
  });

  it("starts spinning again after a double click", () => {
    vi.useFakeTimers();
    const { map, handlers } = createMockMap();
    const control = new SpinGlobeControl();

    control.onAdd(map);
    control.startSpin();
    handlers.get("zoomstart")?.();

    expect(control.isSpinning()).toBe(false);

    handlers.get("dblclick")?.();
    vi.runOnlyPendingTimers();

    expect(control.isSpinning()).toBe(true);
    vi.useRealTimers();
  });

  it("does not bind interaction stop handlers when pauseOnInteraction is false", () => {
    const { map, canvas } = createMockMap();
    const control = new SpinGlobeControl({ pauseOnInteraction: false });

    control.onAdd(map);
    control.startSpin();
    canvas.dispatchEvent(new WheelEvent("wheel"));

    expect(map.on).not.toHaveBeenCalledWith("dragstart", expect.any(Function));
    expect(map.on).not.toHaveBeenCalledWith("zoomstart", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("dblclick", expect.any(Function));
    expect(control.isSpinning()).toBe(true);
  });

  it("starts spinning on double click even when interaction stopping is disabled", () => {
    vi.useFakeTimers();
    const { map, handlers } = createMockMap();
    const control = new SpinGlobeControl({ pauseOnInteraction: false });

    control.onAdd(map);
    handlers.get("dblclick")?.();
    vi.runOnlyPendingTimers();

    expect(control.isSpinning()).toBe(true);
    vi.useRealTimers();
  });

  it("removes interaction handlers on remove", () => {
    const { map } = createMockMap();
    const control = new SpinGlobeControl();

    control.onAdd(map);
    control.onRemove();

    expect(map.off).toHaveBeenCalledWith("dragstart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("rotatestart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("pitchstart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("boxzoomstart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("dblclick", expect.any(Function));
  });
});
