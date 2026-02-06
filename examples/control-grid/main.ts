import maplibregl, { GlobeControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ControlGrid,
  TerrainControl,
  SearchControl,
  ViewStateControl,
  BasemapControl,
  InspectControl,
  VectorDatasetControl,
} from '../../src';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Create controls that will live inside the grid (do not add them to the map directly)
const terrainControl = new TerrainControl({
  exaggeration: 1.0,
  hillshade: true,
});

const viewStateControl = new ViewStateControl({
  collapsed: true,
  enableBBox: true,
  precision: 4,
});

const searchControl = new SearchControl({
  placeholder: 'Search places...',
  flyToZoom: 14,
  showMarker: true,
  collapsed: true,
});

const basemapControl = new BasemapControl({
  collapsed: true,
});

const inspectControl = new InspectControl();

const vectorDatasetControl = new VectorDatasetControl();

// Add a ControlGrid and put the controls inside it
const controlGrid = new ControlGrid({
  title: '',
  position: 'top-right',
  rows: 2,
  columns: 3,
  collapsible: true,
  collapsed: true,
  showRowColumnControls: true,
  gap: 4,
});


controlGrid.addControl(new GlobeControl());
controlGrid.addControl(terrainControl);
controlGrid.addControl(searchControl);
controlGrid.addControl(viewStateControl);
controlGrid.addControl(inspectControl);
controlGrid.addControl(vectorDatasetControl);
controlGrid.addControl(basemapControl);

map.addControl(controlGrid, 'top-right');

// Optional: listen for grid events
controlGrid.on('controladd', () => console.log('Control added to grid'));
controlGrid.on('controlremove', () => console.log('Control removed from grid'));
controlGrid.on('collapse', () => console.log('Grid collapsed'));
controlGrid.on('expand', () => console.log('Grid expanded'));

terrainControl.on('terrainchange', (event) => {
  console.log('Terrain', event.state.enabled ? 'enabled' : 'disabled');
});

searchControl.on('resultselect', (event) => {
  console.log('Selected place:', event.result?.name);
});

console.log('Control Grid example — Terrain, Search, and View State are inside the grid.');
console.log('Use grid.setRows(n) / grid.setColumns(n) or the R/C inputs to change the layout.');
console.log('Use grid.addControl(control) / grid.removeControl(control) to change controls dynamically.');
