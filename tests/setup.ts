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

// Mock control classes used by ControlGrid
class MockControl {
  onAdd = vi.fn().mockReturnValue(document.createElement('div'));
  onRemove = vi.fn();
}

class MockLngLat {
  lng: number;
  lat: number;
  constructor(lng: number, lat: number) { this.lng = lng; this.lat = lat; }
}

class MockMarker {
  setLngLat = vi.fn().mockReturnThis();
  addTo = vi.fn().mockReturnThis();
  remove = vi.fn();
  getElement = vi.fn().mockReturnValue(document.createElement('div'));
}

class MockPopup {
  setLngLat = vi.fn().mockReturnThis();
  setHTML = vi.fn().mockReturnThis();
  addTo = vi.fn().mockReturnThis();
  remove = vi.fn();
}

vi.mock('maplibre-gl', () => ({
  default: { Map: MockMap },
  Map: MockMap,
  FullscreenControl: MockControl,
  GlobeControl: MockControl,
  TerrainControl: MockControl,
  Marker: MockMarker,
  LngLat: MockLngLat,
  Popup: MockPopup,
}));

// Mock external plugins that import from maplibre-gl at module level
const mockPluginControl = () => MockControl;
const mockPluginAdapter = () => MockControl;
vi.mock('maplibre-gl-geo-editor', () => ({
  GeoEditor: mockPluginControl(),
  GeoEditorLayerAdapter: mockPluginAdapter(),
}));
vi.mock('maplibre-gl-lidar', () => ({
  LidarControl: mockPluginControl(),
  LidarLayerAdapter: mockPluginAdapter(),
}));
vi.mock('maplibre-gl-planetary-computer', () => ({
  PlanetaryComputerControl: mockPluginControl(),
  PlanetaryComputerLayerAdapter: mockPluginAdapter(),
}));
vi.mock('maplibre-gl-splat', () => ({
  GaussianSplatControl: mockPluginControl(),
  GaussianSplatLayerAdapter: mockPluginAdapter(),
}));
vi.mock('maplibre-gl-streetview', () => ({
  StreetViewControl: mockPluginControl(),
}));
vi.mock('maplibre-gl-swipe', () => ({
  SwipeControl: mockPluginControl(),
}));
vi.mock('maplibre-gl-usgs-lidar', () => ({
  UsgsLidarControl: mockPluginControl(),
  UsgsLidarLayerAdapter: mockPluginAdapter(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
