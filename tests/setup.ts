import { vi } from 'vitest';

// Mock MapLibre GL
class MockMap {
  addControl = vi.fn();
  removeControl = vi.fn();
  hasControl = vi.fn().mockReturnValue(true);
  on = vi.fn();
  off = vi.fn();
  remove = vi.fn();
  getZoom = vi.fn().mockReturnValue(4);
  getCenter = vi.fn().mockReturnValue({ lng: -98, lat: 38.5 });
  getBounds = vi.fn().mockReturnValue({
    getSouthWest: () => ({ lng: -99, lat: 37.5 }),
    getNorthEast: () => ({ lng: -97, lat: 39.5 }),
    getNorthWest: () => ({ lng: -99, lat: 39.5 }),
    getSouthEast: () => ({ lng: -97, lat: 37.5 }),
  });
  jumpTo = vi.fn();
  flyTo = vi.fn();
  setCenter = vi.fn();
  addSource = vi.fn();
  addLayer = vi.fn();
  getSource = vi.fn();
  unproject = vi.fn().mockReturnValue({ lng: 0, lat: 0 });
  _canvas = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 250, height: 180 }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

vi.mock('maplibre-gl', () => ({
  default: { Map: MockMap },
  Map: MockMap,
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
