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

// Add USGS Imagery as a WMS raster layer on top of the basemap
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
      id: 'usgs-imagery-layer',
      type: 'raster',
      source: 'usgs-imagery',
      paint: {
        'raster-opacity': 0.8,
      },
    },
    // firstSymbol?.id,
  );

  // Add ESA WorldCover 2021 layer (off by default)
  map.addSource('worldcover', {
    type: 'raster',
    tiles: [
      'https://services.terrascope.be/wms/v2?service=WMS&request=GetMap&layers=WORLDCOVER_2021_MAP&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}',
    ],
    tileSize: 256,
    attribution: '&copy; <a href="https://esa-worldcover.org">ESA WorldCover 2021</a>',
  });

  map.addLayer({
    id: 'worldcover-layer',
    type: 'raster',
    source: 'worldcover',
    layout: {
      visibility: 'none',
    },
    paint: {
      'raster-opacity': 0.8,
    },
  });
});
