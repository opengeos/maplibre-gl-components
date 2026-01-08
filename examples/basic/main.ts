import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Colorbar, Legend, HtmlControl } from '../../src';

// Initialize map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), 'top-right');

map.on('load', () => {
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

  // Add an HtmlControl for stats
  const statsControl = new HtmlControl({
    html: `
      <div style="font-size: 13px;">
        <strong>Map Statistics</strong>
        <div style="margin-top: 8px;">
          <div>Zoom: <span id="zoom-level">${map.getZoom().toFixed(2)}</span></div>
          <div>Center: <span id="center-coords">${map.getCenter().lng.toFixed(4)}, ${map.getCenter().lat.toFixed(4)}</span></div>
        </div>
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
console.log('The colorbar will change to viridis after 5 seconds.');
