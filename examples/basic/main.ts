import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';
import {
  Colorbar,
  Legend,
  HtmlControl,
  BasemapControl,
  TerrainControl,
  SearchControl,
  VectorDatasetControl,
  InspectControl,
} from '../../src';

// Initialize map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add globe control
map.addControl(new maplibregl.GlobeControl(), 'top-right');

// Add terrain control - toggle 3D terrain using free AWS Terrarium tiles
const terrainControl = new TerrainControl({
  exaggeration: 1.0,
  hillshade: true,
});
map.addControl(terrainControl, 'top-right');

// Listen for terrain changes
terrainControl.on('terrainchange', (event) => {
  console.log('Terrain', event.state.enabled ? 'enabled' : 'disabled');
});

// Add basemap control - fetches from xyzservices by default
const basemapControl = new BasemapControl({
  defaultBasemap: 'OpenStreetMap.Mapnik',
  showSearch: true,
  collapsible: true,
  displayMode: 'dropdown',
  filterGroups: ['OpenStreetMap', 'CartoDB', 'OpenTopoMap', 'Esri', 'Google'],
  excludeBroken: true,
  maxHeight: 400,
});
map.addControl(basemapControl, 'top-right');

// Listen for basemap changes
basemapControl.on('basemapchange', (event) => {
  console.log('Basemap changed to:', event.basemap?.name);
});

// Add search control - allows searching for places
const searchControl = new SearchControl({
  placeholder: 'Search for a place...',
  flyToZoom: 14,
  showMarker: true,
  markerColor: '#e74c3c',
  collapsed: true,
});
map.addControl(searchControl, 'top-left');

// Listen for search result selection
searchControl.on('resultselect', (event) => {
  console.log('Selected place:', event.result?.name, 'at', event.result?.lng, event.result?.lat);
});

// Add vector dataset control - load GeoJSON files via upload or drag-drop
const vectorControl = new VectorDatasetControl({
  fitBounds: true,
  fitBoundsPadding: 50,
  defaultStyle: {
    fillColor: '#3388ff',
    fillOpacity: 0.3,
    strokeColor: '#3388ff',
    strokeWidth: 2,
    circleRadius: 6,
    circleColor: '#3388ff',
  },
});
map.addControl(vectorControl, 'top-left');

// Listen for dataset load events
vectorControl.on('load', (event) => {
  console.log(
    'Loaded dataset:',
    event.dataset?.filename,
    'with',
    event.dataset?.featureCount,
    'features'
  );
});

vectorControl.on('error', (event) => {
  console.error('Error loading file:', event.error);
});

// Add inspect control - click on features to view their properties
const inspectControl = new InspectControl({
  excludeLayers: ['Background'],
  highlightStyle: {
    fillColor: '#00ff00',
    fillOpacity: 0.3,
    strokeColor: '#00ff00',
    strokeWidth: 3,
  },
  showGeometryType: true,
  showLayerName: true,
});
map.addControl(inspectControl, 'top-left');

// Listen for feature inspection
inspectControl.on('featureselect', (event) => {
  if (event.feature) {
    console.log('Inspected feature from layer:', event.feature.layerId);
    console.log('Properties:', event.feature.feature.properties);
  }
});

map.on('load', () => {
  // Add layer control - allows toggling layer visibility and opacity
  const layerControl = new LayerControl({
    collapsed: true,
    panelWidth: 360,
    panelMinWidth: 240,
    panelMaxWidth: 450,
    showStyleEditor: true,
    showOpacitySlider: true,
    showLayerSymbol: true,
  });
  map.addControl(layerControl, 'top-right');

  // Add a vertical colorbar (like the elevation example)
  const colorbar = new Colorbar({
    colormap: 'terrain',
    vmin: 0,
    vmax: 4000,
    label: 'Elevation (m)',
    orientation: 'vertical',
    barLength: 180,
    barThickness: 18,
    position: 'bottom-right',
    ticks: { count: 5 },
  });
  map.addControl(colorbar, 'bottom-right');

  // Add a horizontal colorbar with custom colors
  const temperatureBar = new Colorbar({
    colormap: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    vmin: -20,
    vmax: 40,
    label: 'Temperature',
    units: '°C',
    orientation: 'horizontal',
    barLength: 200,
    barThickness: 15,
    position: 'bottom-left',
    maxzoom: 8,
  });
  map.addControl(temperatureBar, 'bottom-left');

  // Add a categorical legend (like the NLCD example)
  const legend = new Legend({
    title: 'NLCD Land Cover Type',
    items: [
      { label: '11 Open Water', color: '#476ba1' },
      { label: '12 Perennial Ice/Snow', color: '#d1defa' },
      { label: '21 Developed, Open Space', color: '#ddc9c9' },
      { label: '22 Developed, Low Intensity', color: '#d89382' },
      { label: '23 Developed, Medium Intensity', color: '#ed0000' },
      { label: '24 Developed High Intensity', color: '#aa0000' },
      { label: '31 Barren Land (Rock/Sand/Clay)', color: '#b3afa4' },
      { label: '41 Deciduous Forest', color: '#6ca966' },
      { label: '42 Evergreen Forest', color: '#1d6533' },
      { label: '43 Mixed Forest', color: '#bdcc93' },
      { label: '51 Dwarf Scrub', color: '#af963c' },
      { label: '52 Shrub/Scrub', color: '#d1bb82' },
      { label: '71 Grassland/Herbaceous', color: '#edeccd' },
      { label: '72 Sedge/Herbaceous', color: '#d0d181' },
      { label: '73 Lichens', color: '#a4cc51' },
      { label: '74 Moss', color: '#82ba9b' },
      { label: '81 Pasture/Hay', color: '#ddd83e' },
      { label: '82 Cultivated Crops', color: '#ae7229' },
      { label: '90 Woody Wetlands', color: '#bbd7ed' },
      { label: '95 Emergent Herbaceous Wetlands', color: '#71a4c1' },
    ],
    collapsible: true,
    width: 250,
    maxHeight: 400,
    position: 'top-left',
  });
  map.addControl(legend, 'top-left');

  // Add a legend with different shape types
  const shapeLegend = new Legend({
    title: 'Layer Types',
    items: [
      { label: 'Points of Interest', color: '#e74c3c', shape: 'circle' },
      { label: 'National Parks', color: '#2ecc71', shape: 'square' },
      { label: 'Rivers', color: '#3498db', shape: 'line' },
      { label: 'Roads', color: '#95a5a6', shape: 'line' },
      { label: 'Cities', color: '#9b59b6', shape: 'circle' },
    ],
    collapsible: true,
    collapsed: true,
    width: 180,
    position: 'bottom-left',
  });
  map.addControl(shapeLegend, 'bottom-left');

  // Add a legend with zoom visibility control
  const lidarLegend = new Legend({
    title: 'LiDAR Point Cloud',
    items: [
      { label: 'QL0 (Approx. <= 0.35m NPS)', color: '#003300', shape: 'square' },
      { label: 'QL1 (Approx. 0.35m NPS)', color: '#006600', shape: 'square' },
      { label: 'QL2 (Approx. 0.7m NPS)', color: '#00cc00', shape: 'square' },
      { label: 'QL3 (Approx. 1.4m NPS)', color: '#ccff00', shape: 'square' },
      { label: 'Other', color: '#99ccff', shape: 'square' },
    ],
    collapsible: true,
    width: 220,
    position: 'top-left',
    maxzoom: 10, // Always visible (default max is 24)
  });
  map.addControl(lidarLegend, 'top-left');

  // Add an HtmlControl for stats (with collapsible support)
  const statsControl = new HtmlControl({
    title: 'Map Statistics',
    collapsible: true,
    html: `
      <div style="font-size: 13px;">
        <div>Zoom: <span id="zoom-level">${map.getZoom().toFixed(2)}</span></div>
        <div>Center: <span id="center-coords">${map.getCenter().lng.toFixed(4)}, ${map.getCenter().lat.toFixed(4)}</span></div>
      </div>
    `,
    position: 'top-right',
    maxWidth: 200,
  });
  map.addControl(statsControl, 'top-right');

  // Update stats on map move
  map.on('move', () => {
    const zoomEl = document.getElementById('zoom-level');
    const centerEl = document.getElementById('center-coords');
    if (zoomEl) zoomEl.textContent = map.getZoom().toFixed(2);
    if (centerEl) {
      const center = map.getCenter();
      centerEl.textContent = `${center.lng.toFixed(4)}, ${center.lat.toFixed(4)}`;
    }
  });

  // Demo: change colorbar colormap after 5 seconds
  setTimeout(() => {
    console.log('Changing colorbar to viridis colormap...');
    colorbar.update({
      colormap: 'viridis',
      label: 'Elevation (viridis)',
    });
  }, 5000);
});

// Log events
console.log('MapLibre GL Components - Basic Example');
console.log('Click the terrain button (mountain icon) to toggle 3D terrain.');
console.log('Click the search icon to search for places.');
console.log('Click the upload button or drag-and-drop GeoJSON files to load them.');
console.log('Click the inspect button (info icon) to inspect feature properties.');
console.log('Click the layers button to toggle layer visibility and opacity.');
console.log('The colorbar will change to viridis after 5 seconds.');
