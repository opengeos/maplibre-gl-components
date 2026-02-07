import maplibregl from 'maplibre-gl';
import { ZarrLayerControl, ZarrLayerAdapter } from '../../src';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
  center: [-100, 40],
  zoom: 3,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-left');

// Add Zarr Layer control with sample data pre-filled
// Using CarbonPlan's climate data demo
const zarrControl = new ZarrLayerControl({
  collapsed: false,
  defaultUrl: 'https://carbonplan-maps.s3.us-west-2.amazonaws.com/v2/demo/4d/tavg-prec-month',
  defaultVariable: 'climate',
  // Custom blue colormap for precipitation data - will show as "custom" in dropdown
  defaultColormap: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  defaultClim: [0, 300],
  defaultSelector: { band: 'prec', month: 1 },
  defaultOpacity: 0.8,
  loadDefaultUrl: true,
});


// Create an adapter to integrate Zarr layers with the layer control
const zarrAdapter = new ZarrLayerAdapter(zarrControl);

// Add layer control with the Zarr adapter
const layerControl = new LayerControl({
  collapsed: true,
  layers: [],
  panelWidth: 340,
  panelMinWidth: 240,
  panelMaxWidth: 450,
  basemapStyleUrl: BASEMAP_STYLE,
  customLayerAdapters: [zarrAdapter],
});

map.addControl(layerControl, 'top-right');
map.addControl(zarrControl, 'top-right');

// Listen for layer events
zarrControl.on('layeradd', (event) => {
  console.log('Zarr layer added:', event.url, 'id:', event.layerId);
});

zarrControl.on('layerremove', (event) => {
  console.log('Zarr layer removed:', event.layerId);
});

zarrControl.on('error', (event) => {
  console.error('Zarr layer error:', event.error);
});
