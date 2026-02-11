import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
import { ControlGrid } from '../../src';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

// Add layer control with the COG adapter
const layerControl = new LayerControl({
  collapsed: true,
  layers: [], // LayerControl auto-detects opacity, visibility, and generates friendly names
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
  // Exclude internal layers from controls that add helper/draw layers
  excludeLayers: [
    'usgs-lidar-*',      // USGS LiDAR draw and footprint layers
    'lidar-*',           // LiDAR control layers
    'mapbox-gl-draw-*',  // Draw control layers
    'gl-draw-*',         // Geoman draw layers
  ],
});

map.addControl(layerControl, 'top-right');

// Add a ControlGrid with built-in default controls
const controlGrid = new ControlGrid({
  position: 'top-right',
  rows: 5,
  columns: 5,
  collapsible: true,
  collapsed: true,
  showRowColumnControls: true,
  gap: 2,
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
    'measure',
    'geoEditor',
    'bookmark',
    'print',
    'swipe',
    'streetView',
    'addVector',
    'cogLayer',
    'zarrLayer',
    'pmtilesLayer',
    'stacLayer',
    'stacSearch',
    'planetaryComputer',
    'gaussianSplat',
    'lidar',
    'usgsLidar',
  ],
});

map.addControl(controlGrid, 'top-right');

// Register data-layer adapters so COG, Zarr, PMTiles layers appear in the LayerControl
for (const adapter of controlGrid.getAdapters()) {
  layerControl.registerCustomAdapter(adapter);
}
