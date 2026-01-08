import { vi } from 'vitest';

// Mock MapLibre GL
vi.mock('maplibre-gl', () => ({
  Map: vi.fn().mockImplementation(() => ({
    addControl: vi.fn(),
    removeControl: vi.fn(),
    hasControl: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: vi.fn().mockReturnValue(4),
    getCenter: vi.fn().mockReturnValue({ lng: -98, lat: 38.5 }),
  })),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
