import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
import { addControlGrid, DEFAULT_EXCLUDE_LAYERS } from '../../src';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';

// Plugin CSS imports
import 'maplibre-gl-geo-editor/style.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-planetary-computer/style.css';
import 'maplibre-gl-splat/style.css';
import 'maplibre-gl-streetview/style.css';
import 'maplibre-gl-swipe/style.css';
import 'maplibre-gl-usgs-lidar/style.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

// Add layer control
const layerControl = new LayerControl({
  collapsed: true,
  layers: [],
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
  excludeLayers: [...DEFAULT_EXCLUDE_LAYERS],
});

map.addControl(layerControl, 'top-right');

// Add a ControlGrid with all default controls in one call
const controlGrid = addControlGrid(map, { basemapStyleUrl: BASEMAP_STYLE });

// Register data-layer adapters so COG, Zarr, PMTiles layers appear in the LayerControl
for (const adapter of controlGrid.getAdapters()) {
  layerControl.registerCustomAdapter(adapter);
}
