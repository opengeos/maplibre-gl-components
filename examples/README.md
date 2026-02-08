# MapLibre GL Components - Examples

This directory contains example applications demonstrating how to use the maplibre-gl-components library.

## Examples

### Basic Example

A vanilla TypeScript/JavaScript example showing:

- Colorbar with terrain colormap
- Horizontal colorbar with custom colors
- Categorical legend (NLCD Land Cover style)
- HtmlControl with dynamic map statistics

**Location:** `examples/basic/`

### React Example

A React example demonstrating:

- React wrapper components (ColorbarReact, LegendReact, HtmlControlReact)
- React hooks for state management (useColorbar, useLegend)
- Dynamic updates via React state
- Interactive controls panel

**Location:** `examples/react/`

### Control Grid Example

A vanilla TypeScript example showing the **ControlGrid** component:

- Collapsible grid container that holds multiple map controls (Terrain, Search, View State)
- Configurable rows and columns via options or R/C inputs in the header
- Controls are added with `addControl()` and can be removed with `removeControl()`

**Location:** `examples/control-grid/`

### Control Grid (React) Example

A React example for **ControlGridReact** and **useControlGrid**:

- ControlGridReact hosts TerrainControl, SearchControl, and ViewStateControl in a grid
- useControlGrid hook for rows, columns, and collapsed state
- Optional sidebar to drive grid state from React (expand/collapse, rows, columns)

**Location:** `examples/control-grid-react/`

### STAC Layer Example

A vanilla TypeScript example showing the **StacLayerControl** component:

- Load and visualize COG assets from STAC items
- Single band and RGB composite modes
- Colormap selection for single band visualization
- Rescale range and opacity controls
- Nodata handling with transparency

**Location:** `examples/stac-layer/`

### STAC Search Example

A vanilla TypeScript example showing the **StacSearchControl** component:

- Search STAC catalogs (Element84 Earth Search, Microsoft Planetary Computer)
- Browse and select collections
- Search for items within current map bounds
- Date range filtering
- Display search result footprints on map
- Visualize selected STAC items

**Location:** `examples/stac-search/`

## Running Examples Locally

1. Install dependencies from the project root:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open your browser to the displayed URL (usually http://localhost:5173)

4. Navigate to the examples from the landing page

## Building Examples for Production

To build the examples for deployment:

```bash
npm run build:examples
```

The built files will be in `dist-examples/`.
