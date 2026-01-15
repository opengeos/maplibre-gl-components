# maplibre-gl-components

Legend, colorbar, basemap switcher, terrain toggle, and HTML control components for MapLibre GL JS maps.

[![npm version](https://badge.fury.io/js/maplibre-gl-components.svg)](https://badge.fury.io/js/maplibre-gl-components)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Colorbar** - Continuous gradient legends with built-in matplotlib colormaps
- **Legend** - Categorical legends with color swatches and labels
- **BasemapControl** - Interactive basemap switcher with 100+ providers from xyzservices
- **TerrainControl** - Toggle 3D terrain on/off using free AWS Terrarium elevation tiles
- **HtmlControl** - Flexible HTML content control for custom info panels
- **Zoom-based Visibility** - Show/hide components at specific zoom levels with `minzoom`/`maxzoom`
- **React Support** - First-class React components and hooks
- **TypeScript** - Full type definitions included
- **20+ Built-in Colormaps** - viridis, plasma, terrain, jet, and more

## Installation

```bash
npm install maplibre-gl-components
```

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import maplibregl from 'maplibre-gl';
import { Colorbar, Legend, HtmlControl, BasemapControl, TerrainControl } from 'maplibre-gl-components';
import 'maplibre-gl-components/style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-98, 38.5],
  zoom: 4,
});

// Add a terrain toggle control
const terrainControl = new TerrainControl({
  exaggeration: 1.5,
  hillshade: true,
});
map.addControl(terrainControl, 'top-right');

// Add a basemap switcher
const basemapControl = new BasemapControl({
  defaultBasemap: 'OpenStreetMap.Mapnik',
  showSearch: true,
  filterGroups: ['OpenStreetMap', 'CartoDB', 'Stadia', 'Esri'],
});
map.addControl(basemapControl, 'top-left');

// Add a colorbar
const colorbar = new Colorbar({
  colormap: 'viridis',
  vmin: 0,
  vmax: 100,
  label: 'Temperature',
  units: '°C',
  orientation: 'vertical',
});
map.addControl(colorbar, 'bottom-right');

// Add a legend
const legend = new Legend({
  title: 'Land Cover',
  items: [
    { label: 'Forest', color: '#228B22' },
    { label: 'Water', color: '#4169E1' },
    { label: 'Urban', color: '#808080' },
  ],
  collapsible: true,
});
map.addControl(legend, 'bottom-left');

// Add an HTML control
const htmlControl = new HtmlControl({
  html: '<div><strong>Stats:</strong> 1,234 features</div>',
});
map.addControl(htmlControl, 'top-left');

// Update HTML dynamically
htmlControl.setHtml('<div><strong>Stats:</strong> 5,678 features</div>');
```

### React

```tsx
import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { ColorbarReact, LegendReact, HtmlControlReact, BasemapReact, TerrainReact } from 'maplibre-gl-components/react';
import 'maplibre-gl-components/style.css';

function MyMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [stats, setStats] = useState('Loading...');

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-98, 38.5],
      zoom: 4,
    });

    mapInstance.on('load', () => setMap(mapInstance));

    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {map && (
        <>
          <TerrainReact
            map={map}
            exaggeration={1.5}
            hillshade
            position="top-right"
            onTerrainChange={(enabled) => console.log('Terrain:', enabled)}
          />

          <BasemapReact
            map={map}
            defaultBasemap="OpenStreetMap.Mapnik"
            showSearch
            filterGroups={['OpenStreetMap', 'CartoDB', 'Stadia']}
            position="top-left"
          />

          <ColorbarReact
            map={map}
            colormap="viridis"
            vmin={0}
            vmax={100}
            label="Temperature"
            units="°C"
            position="bottom-right"
          />

          <LegendReact
            map={map}
            title="Categories"
            items={[
              { label: 'Low', color: '#2166ac' },
              { label: 'High', color: '#b2182b' },
            ]}
            position="bottom-left"
            collapsible
          />

          <HtmlControlReact
            map={map}
            html={`<div><strong>Stats:</strong> ${stats}</div>`}
            position="top-left"
          />
        </>
      )}
    </div>
  );
}
```

## API Reference

### Colorbar

A continuous gradient colorbar control.

```typescript
interface ColorbarOptions {
  colormap?: ColormapName | string[];  // Colormap name or custom colors
  colorStops?: ColorStop[];            // Fine-grained color control
  vmin?: number;                       // Minimum value (default: 0)
  vmax?: number;                       // Maximum value (default: 1)
  label?: string;                      // Title/label
  units?: string;                      // Units suffix
  orientation?: 'horizontal' | 'vertical';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  barThickness?: number;               // Bar width/height in pixels
  barLength?: number;                  // Bar length in pixels
  ticks?: { count?: number; values?: number[]; format?: (v: number) => string };
  visible?: boolean;
  backgroundColor?: string;
  opacity?: number;
  fontSize?: number;
  fontColor?: string;
  minzoom?: number;                    // Min zoom level to show (default: 0)
  maxzoom?: number;                    // Max zoom level to show (default: 24)
}

// Methods
colorbar.show()
colorbar.hide()
colorbar.update(options)
colorbar.getState()
colorbar.on(event, handler)
colorbar.off(event, handler)
```

### Legend

A categorical legend control.

```typescript
interface LegendOptions {
  title?: string;
  items?: LegendItem[];                // { label, color, shape?, icon? }
  position?: ControlPosition;
  visible?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  width?: number;
  maxHeight?: number;
  swatchSize?: number;
  backgroundColor?: string;
  opacity?: number;
  fontSize?: number;
  fontColor?: string;
  minzoom?: number;                    // Min zoom level to show (default: 0)
  maxzoom?: number;                    // Max zoom level to show (default: 24)
}

interface LegendItem {
  label: string;
  color: string;
  shape?: 'square' | 'circle' | 'line';
  strokeColor?: string;
  icon?: string;                       // URL to icon image
}

// Methods
legend.show()
legend.hide()
legend.expand()
legend.collapse()
legend.toggle()
legend.setItems(items)
legend.addItem(item)
legend.removeItem(label)
legend.update(options)
legend.getState()
```

### HtmlControl

A flexible HTML content control.

```typescript
interface HtmlControlOptions {
  html?: string;                       // HTML content
  element?: HTMLElement;               // Or provide a DOM element
  position?: ControlPosition;
  visible?: boolean;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  opacity?: number;
  maxWidth?: number;
  maxHeight?: number;
  minzoom?: number;                    // Min zoom level to show (default: 0)
  maxzoom?: number;                    // Max zoom level to show (default: 24)
}

// Methods
htmlControl.show()
htmlControl.hide()
htmlControl.setHtml(html)              // Update HTML content
htmlControl.setElement(element)        // Set DOM element
htmlControl.getElement()               // Get content container
htmlControl.update(options)
htmlControl.getState()
```

### BasemapControl

An interactive basemap switcher that loads providers from [xyzservices](https://github.com/geopandas/xyzservices).

```typescript
interface BasemapControlOptions {
  basemaps?: BasemapItem[];            // Custom basemaps array
  providersUrl?: string;               // URL to fetch providers.json (defaults to xyzservices)
  defaultBasemap?: string;             // Initial basemap ID (e.g., 'OpenStreetMap.Mapnik')
  position?: ControlPosition;
  visible?: boolean;
  collapsible?: boolean;               // Whether control is collapsible (default: true)
  collapsed?: boolean;                 // Whether control starts collapsed (default: true)
  displayMode?: 'dropdown' | 'gallery' | 'list';  // UI mode (default: 'dropdown')
  showSearch?: boolean;                // Show search input (default: true)
  filterGroups?: string[];             // Only include these provider groups
  excludeGroups?: string[];            // Exclude these provider groups
  excludeBroken?: boolean;             // Exclude broken providers (default: true)
  backgroundColor?: string;
  maxWidth?: number;
  maxHeight?: number;
  fontSize?: number;
  fontColor?: string;
  minzoom?: number;
  maxzoom?: number;
}

interface BasemapItem {
  id: string;                          // Unique identifier
  name: string;                        // Display name
  group?: string;                      // Provider group (e.g., 'OpenStreetMap')
  url?: string;                        // XYZ tile URL template
  style?: string;                      // MapLibre style URL
  attribution?: string;
  thumbnail?: string;                  // Preview image URL
  maxZoom?: number;
  minZoom?: number;
  requiresApiKey?: boolean;
  apiKey?: string;
}

// Methods
basemapControl.show()
basemapControl.hide()
basemapControl.expand()
basemapControl.collapse()
basemapControl.toggle()
basemapControl.setBasemap(basemapId)   // Switch to a basemap
basemapControl.getBasemaps()           // Get available basemaps
basemapControl.addBasemap(basemap)     // Add a custom basemap
basemapControl.removeBasemap(id)       // Remove a basemap
basemapControl.setApiKey(id, key)      // Set API key for a basemap
basemapControl.getSelectedBasemap()    // Get currently selected basemap
basemapControl.update(options)
basemapControl.getState()
basemapControl.on('basemapchange', handler)  // Listen for basemap changes
```

**Available Provider Groups:**
- OpenStreetMap, CartoDB, Stadia, Esri, OpenTopoMap
- Thunderforest, MapBox, MapTiler (require API keys)
- NASAGIBS, OpenSeaMap, and 20+ more

### TerrainControl

A toggle control for 3D terrain rendering using free AWS Terrarium elevation tiles.

```typescript
interface TerrainControlOptions {
  sourceUrl?: string;                   // Terrain tile URL (default: AWS Terrarium)
  encoding?: 'terrarium' | 'mapbox';    // Terrain encoding (default: 'terrarium')
  exaggeration?: number;                // Vertical scale factor (default: 1.0)
  enabled?: boolean;                    // Initial terrain state (default: false)
  hillshade?: boolean;                  // Add hillshade layer (default: true)
  hillshadeExaggeration?: number;       // Hillshade intensity (default: 0.5)
  position?: ControlPosition;
  visible?: boolean;
  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
  minzoom?: number;                     // Min zoom level to show (default: 0)
  maxzoom?: number;                     // Max zoom level to show (default: 24)
}

// Methods
terrainControl.show()
terrainControl.hide()
terrainControl.enable()                 // Enable terrain
terrainControl.disable()                // Disable terrain
terrainControl.toggle()                 // Toggle terrain on/off
terrainControl.isEnabled()              // Check if terrain is enabled
terrainControl.setExaggeration(value)   // Set vertical exaggeration (0.1 - 10.0)
terrainControl.getExaggeration()        // Get current exaggeration
terrainControl.enableHillshade()        // Enable hillshade layer
terrainControl.disableHillshade()       // Disable hillshade layer
terrainControl.toggleHillshade()        // Toggle hillshade layer
terrainControl.update(options)
terrainControl.getState()
terrainControl.on('terrainchange', handler)  // Listen for terrain toggle
```

**Terrain Source:**
The control uses free terrain tiles from AWS:
- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Encoding: Terrarium RGB-encoded elevation data
- No API key required

## Built-in Colormaps

### Sequential
- `viridis` - Perceptually uniform, colorblind-friendly
- `plasma` - Perceptually uniform
- `inferno` - Perceptually uniform
- `magma` - Perceptually uniform
- `cividis` - Colorblind-friendly

### Diverging
- `coolwarm` - Blue to red through white
- `bwr` - Blue-white-red
- `seismic` - Blue to red
- `RdBu` - Red to blue
- `RdYlBu` - Red-yellow-blue
- `RdYlGn` - Red-yellow-green
- `spectral` - Rainbow-like diverging

### Miscellaneous
- `jet` - Classic rainbow
- `rainbow` - Full spectrum
- `turbo` - Improved rainbow
- `terrain` - Elevation-like
- `ocean` - Ocean depths
- `hot` - Black-red-yellow-white
- `cool` - Cyan to magenta
- `gray` - Grayscale
- `bone` - Blue-tinted grayscale

### Custom Colors

```typescript
// Use an array of colors
const colorbar = new Colorbar({
  colormap: ['#0000ff', '#00ff00', '#ffff00', '#ff0000'],
  vmin: 0,
  vmax: 100,
});

// Or use color stops for precise control
const colorbar = new Colorbar({
  colorStops: [
    { position: 0, color: '#0000ff' },
    { position: 0.3, color: '#00ff00' },
    { position: 0.7, color: '#ffff00' },
    { position: 1, color: '#ff0000' },
  ],
  vmin: 0,
  vmax: 100,
});
```

## Zoom-based Visibility

All components support `minzoom` and `maxzoom` options to control visibility based on the map's zoom level. This is useful for showing different legends at different zoom levels, similar to how map layers work.

```typescript
// Show legend only when zoomed in (zoom >= 10)
const detailLegend = new Legend({
  title: 'Detailed Features',
  items: [...],
  minzoom: 10,  // Only visible at zoom 10 and above
});

// Show legend only when zoomed out (zoom <= 8)
const overviewLegend = new Legend({
  title: 'Overview',
  items: [...],
  maxzoom: 8,  // Only visible at zoom 8 and below
});

// Show colorbar only within a specific zoom range
const colorbar = new Colorbar({
  colormap: 'viridis',
  vmin: 0,
  vmax: 100,
  minzoom: 5,   // Visible from zoom 5...
  maxzoom: 15,  // ...up to zoom 15
});
```

### React Example

```tsx
<LegendReact
  map={map}
  title="Lidar Point Cloud"
  items={[
    { label: 'QL0 (Approx. <= 0.35m NPS)', color: '#003300' },
    { label: 'QL1 (Approx. 0.35m NPS)', color: '#006600' },
    { label: 'QL2 (Approx. 0.7m NPS)', color: '#00cc00' },
    { label: 'QL3 (Approx. 1.4m NPS)', color: '#ccff00' },
    { label: 'Other', color: '#99ccff' },
  ]}
  minzoom={8}
  maxzoom={18}
  position="top-left"
/>
```

**Note:** The `visible` option takes precedence - if `visible` is `false`, the component will be hidden regardless of zoom level.

## React Hooks

```typescript
import { useColorbar, useLegend, useHtmlControl, useBasemap, useTerrain } from 'maplibre-gl-components/react';

function MyComponent() {
  const colorbar = useColorbar({ colormap: 'viridis', vmin: 0, vmax: 100 });
  const legend = useLegend({ items: [...] });
  const htmlControl = useHtmlControl({ html: '...' });
  const basemap = useBasemap({ selectedBasemap: 'OpenStreetMap.Mapnik' });
  const terrain = useTerrain({ enabled: false, exaggeration: 1.5 });

  return (
    <>
      <button onClick={() => colorbar.setColormap('plasma')}>
        Change Colormap
      </button>
      <button onClick={() => legend.toggle()}>
        Toggle Legend
      </button>
      <button onClick={() => basemap.setBasemap('CartoDB.Positron')}>
        Change Basemap
      </button>
      <button onClick={() => terrain.toggle()}>
        Toggle Terrain
      </button>

      <TerrainReact
        map={map}
        enabled={terrain.state.enabled}
        exaggeration={terrain.state.exaggeration}
        onTerrainChange={(enabled) => terrain.setEnabled(enabled)}
      />

      <BasemapReact
        map={map}
        defaultBasemap={basemap.state.selectedBasemap}
        onBasemapChange={(b) => basemap.setBasemap(b.id)}
      />

      <ColorbarReact
        map={map}
        {...colorbar.state}
        vmin={colorbar.state.vmin}
        vmax={colorbar.state.vmax}
      />
    </>
  );
}
```

## Styling

The default styles can be customized using CSS:

```css
/* Override colorbar styles */
.maplibre-gl-colorbar {
  background: rgba(0, 0, 0, 0.8);
  color: white;
}

/* Override legend styles */
.maplibre-gl-legend {
  font-size: 14px;
  border-radius: 8px;
}

/* Override HTML control styles */
.maplibre-gl-html-control {
  max-width: 400px;
}

/* Override basemap control styles */
.maplibre-gl-basemap {
  max-width: 300px;
}

/* Override terrain control styles */
.maplibre-gl-terrain-button {
  color: #0078d7;
}
```

## Examples

See the [examples](./examples/) directory for complete working examples:

- **Basic Example** - Vanilla TypeScript with all three components
- **React Example** - React with hooks and dynamic updates

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Build examples
npm run build:examples
```

## Docker

The examples can be run using Docker. The image is automatically built and published to GitHub Container Registry.

### Pull and Run

```bash
# Pull the latest image
docker pull ghcr.io/opengeos/maplibre-gl-components:latest

# Run the container
docker run -p 8080:80 ghcr.io/opengeos/maplibre-gl-components:latest
```

Then open http://localhost:8080/maplibre-gl-components/ in your browser to view the examples.

### Build Locally

```bash
# Build the image
docker build -t maplibre-gl-components .

# Run the container
docker run -p 8080:80 maplibre-gl-components
```

### Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest release |
| `x.y.z` | Specific version (e.g., `1.0.0`) |
| `x.y` | Minor version (e.g., `1.0`) |


## License

MIT License - see [LICENSE](./LICENSE) for details.
