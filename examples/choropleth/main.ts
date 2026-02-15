import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ChoroplethControl } from '../../src';
import '../../src/lib/styles/choropleth-control.css';
import '../../src/lib/styles/common.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// H3 hexagonal grid dataset at resolution 4
const SAMPLE_DATA = 'https://data.source.coop/giswqs/opengeos/h3_res4_geo.parquet';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [0, 20],
  zoom: 2,
  maxPitch: 85,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

// Add Choropleth control with sample data pre-filled
const choroplethControl = new ChoroplethControl({
  collapsed: false,
  defaultUrl: SAMPLE_DATA,
  defaultColormap: 'viridis',
  defaultScheme: 'quantile',
  defaultK: 5,
  defaultOpacity: 0.8,
  defaultPickable: true,
});

map.addControl(choroplethControl, 'top-right');

// Listen for layer events
choroplethControl.on('layeradd', (event) => {
  console.log('Choropleth layer added:', event.url, 'id:', event.layerId);
});

choroplethControl.on('layerremove', (event) => {
  console.log('Choropleth layer removed:', event.layerId);
});

choroplethControl.on('error', (event) => {
  console.error('Choropleth error:', event.error);
});

console.log('Choropleth Map Example');
console.log('- Click "Load Data" to load the H3 hexagonal grid dataset');
console.log('- Select a numeric column and click "Add Choropleth"');
console.log('- Try different colormaps, classification schemes, and class counts');
console.log('- Enable 3D Extrusion for a 3D view (tilt the map with right-click drag)');
