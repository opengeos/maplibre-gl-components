import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ControlGridReact, useControlGrid } from '../../src/react';
import { TerrainControl, SearchControl, ViewStateControl } from '../../src';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const gridState = useControlGrid({
    rows: 1,
    columns: 3,
    collapsed: true,
  });

  // Create control instances once (not added to map directly; ControlGrid hosts them)
  const terrainControl = useRef(new TerrainControl({ exaggeration: 1, hillshade: true })).current;
  const searchControl = useRef(
    new SearchControl({ placeholder: 'Search places...', flyToZoom: 14, collapsed: true })
  ).current;
  const viewStateControl = useRef(
    new ViewStateControl({ collapsed: true, enableBBox: true, precision: 4 })
  ).current;

  const gridControls = useMemo(
    () => [terrainControl, searchControl, viewStateControl],
    [terrainControl, searchControl, viewStateControl]
  );

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-98, 38.5],
      zoom: 4,
      maxPitch: 85,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.addControl(new maplibregl.GlobeControl(), 'top-right');

    mapInstance.on('load', () => {
      mapRef.current = mapInstance;
      setMap(mapInstance);
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <div className="info-banner">
        <strong>Control Grid (React)</strong> — ControlGridReact with useControlGrid. Rows:{' '}
        {gridState.state.rows}, Columns: {gridState.state.columns}, Collapsed:{' '}
        {gridState.state.collapsed ? 'Yes' : 'No'}
      </div>

      {map && (
        <ControlGridReact
          map={map}
          title=""
          position="top-right"
          rows={gridState.state.rows}
          columns={gridState.state.columns}
          collapsible
          showRowColumnControls
          collapsed={gridState.state.collapsed}
          controls={gridControls}
          onStateChange={(state) => gridState.setState(state)}
        />
      )}

      {/* Optional: panel to drive grid state from React */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(255,255,255,0.95)',
          padding: 12,
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          zIndex: 10,
          fontSize: 13,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600 }}>Grid:</span>
        <button
          type="button"
          onClick={() => gridState.toggle()}
          style={{ padding: '4px 10px', cursor: 'pointer' }}
        >
          {gridState.state.collapsed ? 'Expand' : 'Collapse'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Rows:
          <input
            type="number"
            min={1}
            max={12}
            value={gridState.state.rows}
            onChange={(e) => gridState.setRows(Number(e.target.value) || 1)}
            style={{ width: 44, padding: '2px 4px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Cols:
          <input
            type="number"
            min={1}
            max={12}
            value={gridState.state.columns}
            onChange={(e) => gridState.setColumns(Number(e.target.value) || 1)}
            style={{ width: 44, padding: '2px 4px' }}
          />
        </label>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
