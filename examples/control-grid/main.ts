import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ControlGrid } from '../../src';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add a ControlGrid with built-in default controls
const controlGrid = new ControlGrid({
  position: 'top-right',
  rows: 3,
  columns: 3,
  collapsible: true,
  collapsed: true,
  showRowColumnControls: true,
  gap: 4,
  defaultControls: [
    'globe',
    'fullscreen',
    'north',
    'terrain',
    'search',
    'viewState',
    'inspect',
    'vectorDataset',
    'basemap',
  ],
});

map.addControl(controlGrid, 'top-right');

// Optional: listen for grid events
controlGrid.on('controladd', () => console.log('Control added to grid'));
controlGrid.on('controlremove', () => console.log('Control removed from grid'));
controlGrid.on('collapse', () => console.log('Grid collapsed'));
controlGrid.on('expand', () => console.log('Grid expanded'));

console.log('Control Grid example — using defaultControls for built-in controls.');
console.log('Use grid.setRows(n) / grid.setColumns(n) or the R/C inputs to change the layout.');
