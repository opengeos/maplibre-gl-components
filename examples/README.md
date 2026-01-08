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
