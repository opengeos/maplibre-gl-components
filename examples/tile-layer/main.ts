import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TileLayerControl } from '../../src';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-100, 40],
  zoom: 3,
});

map.addControl(new maplibregl.NavigationControl());

const tileControl = new TileLayerControl({
  collapsed: false,
  defaultOpacity: 0.8,
});

map.addControl(tileControl, 'top-right');

// Status display
const statusEl = document.getElementById('status');
const updateStatus = () => {
  if (statusEl) {
    statusEl.textContent = `Layers: ${tileControl.getLayers().length}`;
  }
};

tileControl.on('layeradd', (e) => {
  console.log('Layer added:', e.layer?.name, e.layer?.url);
  updateStatus();
});

tileControl.on('layerremove', (e) => {
  console.log('Layer removed:', e.layer?.name);
  updateStatus();
});

tileControl.on('layervisibility', (e) => {
  console.log('Layer visibility:', e.layer?.name, e.layer?.visible);
});

tileControl.on('layeropacity', (e) => {
  console.log('Layer opacity:', e.layer?.name, e.layer?.opacity);
});

// Info panel toggle
const infoToggle = document.getElementById('info-toggle');
const infoPanel = document.getElementById('info-panel');
infoToggle?.addEventListener('click', () => {
  infoPanel?.classList.toggle('visible');
});
