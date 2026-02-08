import maplibregl from 'maplibre-gl';
import { CoordinateControl } from '../../src';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on('load', () => {
  // Add the CoordinateControl
  const coordControl = new CoordinateControl({
    position: 'bottom-left',
    format: 'decimal',
    precision: 6,
    showZoom: true,
    copyOnClick: true,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  });

  map.addControl(coordControl, 'bottom-left');

  // Listen for events
  coordControl.on('copy', (event) => {
    console.log('Coordinates copied:', event.coordinates);
  });

  coordControl.on('formatchange', (event) => {
    console.log('Format changed to:', event.state.format);
  });
});
