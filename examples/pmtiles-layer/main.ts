import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PMTilesLayerControl, PMTilesLayerAdapter } from '../../src';
import '../../src/lib/styles/pmtiles-layer.css';
import '../../src/lib/styles/common.css';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [11.25, 43.77], // Florence, Italy (matches the example PMTiles)
  zoom: 12,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

// Add PMTiles Layer control with sample data pre-filled
// Using Protomaps Florence example from the MapLibre docs
const pmtilesControl = new PMTilesLayerControl({
  collapsed: false,
  defaultUrl: 'https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles',
  defaultOpacity: 0.8,
  defaultFillColor: 'steelblue',
  defaultLineColor: '#333',
  loadDefaultUrl: true,
});


// Create an adapter to integrate PMTiles layers with the layer control
const pmtilesAdapter = new PMTilesLayerAdapter(pmtilesControl, {
  name: 'Florence PMTiles',
});

// Add layer control with the PMTiles adapter
const layerControl = new LayerControl({
  collapsed: true,
  layers: [],
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
  customLayerAdapters: [pmtilesAdapter],
});

map.addControl(layerControl, 'top-right');
map.addControl(pmtilesControl, 'top-right');

// Listen for layer events
pmtilesControl.on('layeradd', (event) => {
  console.log('PMTiles layer added:', event.url, 'id:', event.layerId);
});

pmtilesControl.on('layerremove', (event) => {
  console.log('PMTiles layer removed:', event.layerId);
});

pmtilesControl.on('error', (event) => {
  console.error('PMTiles layer error:', event.error);
});
