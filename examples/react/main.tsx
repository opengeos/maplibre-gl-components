import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LayerControl } from 'maplibre-gl-layer-control';
import 'maplibre-gl-layer-control/style.css';
import {
  ColorbarReact,
  LegendReact,
  HtmlControlReact,
  BasemapReact,
  TerrainReact,
  SearchControlReact,
  VectorDatasetReact,
  InspectControlReact,
  useColorbar,
  useLegend,
  useBasemap,
  useTerrain,
  useSearchControl,
  useVectorDataset,
  useInspectControl,
} from '../../src/react';
import type { ColormapName, BasemapItem, SearchResult, LoadedDataset, InspectedFeature } from '../../src';

const COLORMAP_OPTIONS: ColormapName[] = [
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'turbo',
  'terrain',
  'coolwarm',
  'jet',
  'rainbow',
];

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [zoom, setZoom] = useState(4);
  const [center, setCenter] = useState({ lng: -98, lat: 38.5 });

  // Use hooks for state management
  const colorbarState = useColorbar({
    colormap: 'viridis',
    vmin: 0,
    vmax: 100,
    visible: true,
  });

  const legendState = useLegend({
    visible: true,
    collapsed: false,
    items: [
      { label: 'Low', color: '#2166ac', shape: 'square' },
      { label: 'Medium-Low', color: '#67a9cf', shape: 'square' },
      { label: 'Medium', color: '#fddbc7', shape: 'square' },
      { label: 'Medium-High', color: '#ef8a62', shape: 'square' },
      { label: 'High', color: '#b2182b', shape: 'square' },
    ],
  });

  const basemapState = useBasemap({
    selectedBasemap: 'OpenStreetMap.Mapnik',
    collapsed: true,
  });

  const terrainState = useTerrain({
    enabled: false,
    exaggeration: 1.5,
    hillshade: true,
  });

  const searchState = useSearchControl({
    collapsed: true,
  });

  const vectorDatasetState = useVectorDataset();

  const inspectState = useInspectControl({
    enabled: false,
  });

  const [currentBasemap, setCurrentBasemap] = useState<string>('OpenStreetMap.Mapnik');
  const [lastSearchResult, setLastSearchResult] = useState<SearchResult | null>(null);
  const [lastLoadedDataset, setLastLoadedDataset] = useState<LoadedDataset | null>(null);
  const [lastInspectedFeature, setLastInspectedFeature] = useState<InspectedFeature | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [center.lng, center.lat],
      zoom: zoom,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.on('load', () => {
      mapRef.current = mapInstance;
      setMap(mapInstance);

      // Add layer control
      const layerControl = new LayerControl({
        collapsed: true,
        panelWidth: 320,
        panelMinWidth: 240,
        panelMaxWidth: 450,
        showStyleEditor: true,
        showOpacitySlider: true,
        showLayerSymbol: true,
      });
      mapInstance.addControl(layerControl, 'top-right');
    });

    mapInstance.on('move', () => {
      setZoom(mapInstance.getZoom());
      setCenter({
        lng: mapInstance.getCenter().lng,
        lat: mapInstance.getCenter().lat,
      });
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Controls Panel */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          right: 10,
          background: 'white',
          padding: 12,
          borderRadius: 4,
          boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          fontSize: 13,
          maxWidth: 220,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Controls</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Colormap:</label>
          <select
            value={colorbarState.state.colormap as string}
            onChange={(e) => colorbarState.setColormap(e.target.value as ColormapName)}
            style={{ width: '100%', padding: 4 }}
          >
            {COLORMAP_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            Vmin: {colorbarState.state.vmin}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            value={colorbarState.state.vmin}
            onChange={(e) => colorbarState.setVmin(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            Vmax: {colorbarState.state.vmax}
          </label>
          <input
            type="range"
            min="50"
            max="200"
            value={colorbarState.state.vmax}
            onChange={(e) => colorbarState.setVmax(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={colorbarState.state.visible}
              onChange={(e) => colorbarState.setVisible(e.target.checked)}
            />{' '}
            Show Colorbar
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={legendState.state.visible}
              onChange={(e) => legendState.setVisible(e.target.checked)}
            />{' '}
            Show Legend
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => legendState.toggle()}
            disabled={!legendState.state.visible}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            {legendState.state.collapsed ? 'Expand' : 'Collapse'} Legend
          </button>
        </div>

        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <div style={{ fontWeight: 600, marginBottom: 12 }}>Search</div>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => searchState.toggle()}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            {searchState.state.collapsed ? 'Expand' : 'Collapse'} Search
          </button>
        </div>

        {lastSearchResult && (
          <div style={{ marginBottom: 12, fontSize: 11, color: '#666' }}>
            <strong>Last result:</strong> {lastSearchResult.name}
          </div>
        )}

        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <div style={{ fontWeight: 600, marginBottom: 12 }}>Terrain</div>

        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={terrainState.state.enabled}
              onChange={(e) => terrainState.setEnabled(e.target.checked)}
            />{' '}
            Enable 3D Terrain
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            Exaggeration: {terrainState.state.exaggeration.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={terrainState.state.exaggeration}
            onChange={(e) => terrainState.setExaggeration(Number(e.target.value))}
            style={{ width: '100%' }}
            disabled={!terrainState.state.enabled}
          />
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={terrainState.state.hillshade}
              onChange={(e) => terrainState.setHillshade(e.target.checked)}
              disabled={!terrainState.state.enabled}
            />{' '}
            Show Hillshade
          </label>
        </div>

        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <div style={{ fontWeight: 600, marginBottom: 12 }}>Vector Data</div>

        <div style={{ marginBottom: 12, fontSize: 11, color: '#666' }}>
          {vectorDatasetState.state.loadedDatasets.length} dataset(s) loaded
        </div>

        {lastLoadedDataset && (
          <div style={{ marginBottom: 12, fontSize: 11, color: '#666' }}>
            <strong>Last loaded:</strong> {lastLoadedDataset.filename}
            <br />
            <span>{lastLoadedDataset.featureCount} features</span>
          </div>
        )}

        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <div style={{ fontWeight: 600, marginBottom: 12 }}>Inspect</div>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => inspectState.toggle()}
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              backgroundColor: inspectState.state.enabled ? '#0078d7' : undefined,
              color: inspectState.state.enabled ? 'white' : undefined,
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          >
            {inspectState.state.enabled ? 'Disable' : 'Enable'} Inspect
          </button>
        </div>

        {lastInspectedFeature && (
          <div style={{ marginBottom: 12, fontSize: 11, color: '#666' }}>
            <strong>Layer:</strong> {lastInspectedFeature.layerId}
            <br />
            <strong>Type:</strong> {lastInspectedFeature.feature.geometry.type}
          </div>
        )}
      </div>

      {/* Map Controls */}
      {map && (
        <>
          <VectorDatasetReact
            map={map}
            fitBounds={true}
            fitBoundsPadding={50}
            position="top-left"
            onDatasetLoad={(dataset: LoadedDataset) => {
              setLastLoadedDataset(dataset);
              vectorDatasetState.addDataset(dataset);
              console.log('React: Loaded dataset:', dataset.filename);
            }}
            onError={(error, filename) => {
              console.error('React: Error loading', filename, ':', error);
            }}
          />

          <SearchControlReact
            map={map}
            placeholder="Search for a place..."
            flyToZoom={14}
            showMarker
            markerColor="#e74c3c"
            collapsed={searchState.state.collapsed}
            position="top-left"
            onResultSelect={(result: SearchResult) => {
              setLastSearchResult(result);
              searchState.selectResult(result);
              console.log('React: Selected place:', result.name);
            }}
          />

          <BasemapReact
            map={map}
            defaultBasemap={currentBasemap}
            showSearch
            collapsible
            displayMode="dropdown"
            filterGroups={['OpenStreetMap', 'CartoDB', 'Stadia', 'OpenTopoMap', 'Esri']}
            excludeBroken
            position="top-left"
            maxHeight={300}
            onBasemapChange={(basemap: BasemapItem) => {
              setCurrentBasemap(basemap.id);
              console.log('React: Basemap changed to:', basemap.name);
            }}
          />

          <TerrainReact
            map={map}
            enabled={terrainState.state.enabled}
            exaggeration={terrainState.state.exaggeration}
            hillshade={terrainState.state.hillshade}
            position="top-right"
            onTerrainChange={(enabled) => {
              terrainState.setEnabled(enabled);
              console.log('React: Terrain', enabled ? 'enabled' : 'disabled');
            }}
          />

          <ColorbarReact
            map={map}
            colormap={colorbarState.state.colormap}
            vmin={colorbarState.state.vmin}
            vmax={colorbarState.state.vmax}
            label="Data Value"
            units=""
            orientation="vertical"
            barLength={180}
            position="bottom-right"
            visible={colorbarState.state.visible}
          />

          <LegendReact
            map={map}
            title="Risk Level"
            items={legendState.state.items}
            visible={legendState.state.visible}
            collapsed={legendState.state.collapsed}
            collapsible
            position="bottom-left"
          />

          <LegendReact
            map={map}
            title="Lidar Point Cloud (8)"
            items={[
              { label: 'QL0 (Approx. <= 0.35m NPS)', color: '#003300', shape: 'square' },
              { label: 'QL1 (Approx. 0.35m NPS)', color: '#006600', shape: 'square' },
              { label: 'QL2 (Approx. 0.7m NPS)', color: '#00cc00', shape: 'square' },
              { label: 'QL3 (Approx. 1.4m NPS)', color: '#ccff00', shape: 'square' },
              { label: 'Other', color: '#99ccff', shape: 'square' },
            ]}
            visible={true}
            collapsible={false}
            position="top-left"
            maxzoom={10}
          />

          <HtmlControlReact
            map={map}
            html={`
              <div style="font-size: 12px;">
                <strong>Map Info</strong>
                <div style="margin-top: 6px;">
                  <div>Zoom: ${zoom.toFixed(2)}</div>
                  <div>Center: ${center.lng.toFixed(4)}, ${center.lat.toFixed(4)}</div>
                </div>
              </div>
            `}
            position="top-left"
            maxWidth={180}
          />

          <InspectControlReact
            map={map}
            position="top-left"
            enabled={inspectState.state.enabled}
            excludeLayers={['background']}
            highlightStyle={{
              fillColor: '#00ff00',
              fillOpacity: 0.3,
              strokeColor: '#00ff00',
              strokeWidth: 3,
            }}
            onFeatureSelect={(feature) => {
              setLastInspectedFeature(feature);
              if (feature) {
                console.log('React: Inspected feature from layer:', feature.layerId);
              }
            }}
            onToggle={(enabled) => {
              inspectState.setEnabled(enabled);
            }}
          />
        </>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
