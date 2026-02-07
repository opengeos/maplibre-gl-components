import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AddVectorControl, AddVectorAdapter } from '../../src';
import '../../src/lib/styles/add-vector.css';
import '../../src/lib/styles/common.css';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Sample GeoJSON URLs for testing
const SAMPLE_GEOJSON = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [0, 20],
  zoom: 2,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

// Add AddVector control with sample data pre-filled
const addVectorControl = new AddVectorControl({
  collapsed: false,
  defaultUrl: SAMPLE_GEOJSON,
  defaultOpacity: 0.8,
  defaultFillColor: '#3388ff',
  defaultStrokeColor: '#2266cc',
  loadDefaultUrl: false, // Don't auto-load, let user click Add Layer
});

// Create an adapter to integrate AddVector layers with the layer control
const addVectorAdapter = new AddVectorAdapter(addVectorControl, {
  name: 'Vector Data',
});

// Add layer control with the AddVector adapter
const layerControl = new LayerControl({
  collapsed: true,
  layers: [],
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
  customLayerAdapters: [addVectorAdapter],
});

map.addControl(layerControl, 'top-right');
map.addControl(addVectorControl, 'top-right');

// Listen for layer events
addVectorControl.on('layeradd', (event) => {
  console.log('Vector layer added:', event.url, 'id:', event.layerId);
});

addVectorControl.on('layerremove', (event) => {
  console.log('Vector layer removed:', event.layerId);
});

addVectorControl.on('error', (event) => {
  console.error('Vector layer error:', event.error);
});

// Log some example URLs for users to try
console.log('Example vector URLs to try:');
console.log('- GeoJSON: https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
console.log('- FlatGeobuf: https://flatgeobuf.org/test/data/countries.fgb');
