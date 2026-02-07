import maplibregl from 'maplibre-gl';
import { CogLayerControl } from '../../src';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

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
  console.log('COG layer added:', event.url);
});

cogControl.on('layerremove', () => {
  console.log('COG layer removed');
});

cogControl.on('layerupdate', (event) => {
  console.log('COG layer updated:', event.url);
});

cogControl.on('error', (event) => {
  console.error('COG layer error:', event.error);
});
