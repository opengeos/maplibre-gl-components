import maplibregl from 'maplibre-gl';
import { CogLayerControl } from '../../src';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';


const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [-98, 38.5],
  zoom: 4,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');


const layerControl = new LayerControl({
  collapsed: true,
  layers: [], // LayerControl auto-detects opacity, visibility, and generates friendly names
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
});

map.addControl(layerControl, 'top-right');

// Add COG Layer control with a sample COG URL pre-filled
const cogControl = new CogLayerControl({
  collapsed: false,
  defaultUrl:
    'https://s3.us-east-1.amazonaws.com/ds-deck.gl-raster-public/cog/Annual_NLCD_LndCov_2024_CU_C1V1.tif',
  defaultColormap: 'none',
  defaultRescaleMin: 0,
  defaultRescaleMax: 4000,
});

map.addControl(cogControl, 'top-right');

// Listen for layer events
cogControl.on('layeradd', (event) => {
  console.log('COG layer added:', event.url, 'id:', event.layerId);
});

cogControl.on('layerremove', (event) => {
  console.log('COG layer removed:', event.layerId);
});

cogControl.on('error', (event) => {
  console.error('COG layer error:', event.error);
});
