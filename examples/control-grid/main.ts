import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
import { ControlGrid } from '../../src';
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

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN || '';

// Exclude internal layers from controls that add helper/draw layers
const EXCLUDE_LAYERS = [
  'usgs-lidar-*',        // USGS LiDAR draw and footprint layers
  'lidar-*',             // LiDAR control layers
  'mapbox-gl-draw-*',    // Draw control layers
  'gl-draw-*',           // Geoman draw layers (old prefix)
  'gm_*',                // Geoman draw layers (new prefix)
  'inspect-highlight-*', // InspectControl highlight layers
  'measure-*',           // MeasureControl measurement layers
];

const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP_STYLE,
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
  excludeLayers: EXCLUDE_LAYERS,
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
  basemapStyleUrl: BASEMAP_STYLE,
  excludeLayers: EXCLUDE_LAYERS,
  streetViewOptions: {
    googleApiKey: GOOGLE_API_KEY,
    mapillaryAccessToken: MAPILLARY_TOKEN,
  },
  defaultControls: [
    'globe',
    'spinGlobe',
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

// Add USGS Imagery basemap as a WMS raster layer
map.on('load', () => {
  map.addSource('usgs-imagery', {
    type: 'raster',
    tiles: [
      'https://basemap.nationalmap.gov/arcgis/services/USGSImageryOnly/MapServer/WMSServer?service=WMS&request=GetMap&layers=0&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}',
    ],
    tileSize: 256,
    attribution: '&copy; <a href="https://basemap.nationalmap.gov/">USGS</a>',
  });

  // const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol');
  map.addLayer(
    {
      id: 'USGS-imagery-layer',
      type: 'raster',
      source: 'usgs-imagery',
      paint: {
        'raster-opacity': 0.8,
      },
    },
    // firstSymbol?.id,
  );
});
