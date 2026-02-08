import maplibregl from 'maplibre-gl';
import { MeasureControl } from '../../src';

// Make maplibregl available globally for marker creation
(window as any).maplibregl = maplibregl;

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on('load', () => {
  // Add the MeasureControl
  const measureControl = new MeasureControl({
    position: 'top-right',
    collapsed: true,
    defaultMode: 'distance',
    distanceUnit: 'kilometers',
    areaUnit: 'square-kilometers',
    lineColor: '#3b82f6',
    fillColor: 'rgba(59, 130, 246, 0.2)',
    pointColor: '#ef4444',
    showSegments: true,
    precision: 2,
  });

  map.addControl(measureControl, 'top-right');

  // Listen for measurement events
  measureControl.on('drawend', (event) => {
    console.log('Measurement completed:', event.measurement);
  });

  measureControl.on('clear', () => {
    console.log('All measurements cleared');
  });

  measureControl.on('modechange', (event) => {
    console.log('Mode changed to:', event.state.mode);
  });
});
