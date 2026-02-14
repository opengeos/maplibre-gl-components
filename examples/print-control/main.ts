import maplibregl from "maplibre-gl";
import { PrintControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
  preserveDrawingBuffer: true,
});

map.on("load", () => {
  // Add a raster layer (OpenStreetMap tiles)
  map.addSource("osm-raster", {
    type: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  map.addLayer(
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster",
      paint: {
        "raster-opacity": 0.5,
      },
    },
    "waterway", // Insert below labels
  );

  // Add a GeoJSON source with sample data (San Francisco landmarks)
  map.addSource("sf-landmarks", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Golden Gate Park" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-122.5108, 37.7694],
                [-122.4534, 37.7694],
                [-122.4534, 37.7745],
                [-122.5108, 37.7745],
                [-122.5108, 37.7694],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Market Street" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-122.4194, 37.7749],
              [-122.3943, 37.7915],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Ferry Building" },
          geometry: {
            type: "Point",
            coordinates: [-122.3936, 37.7955],
          },
        },
        {
          type: "Feature",
          properties: { name: "Coit Tower" },
          geometry: {
            type: "Point",
            coordinates: [-122.4058, 37.8024],
          },
        },
        {
          type: "Feature",
          properties: { name: "Pier 39" },
          geometry: {
            type: "Point",
            coordinates: [-122.4094, 37.8087],
          },
        },
      ],
    },
  });

  // Add polygon fill layer
  map.addLayer({
    id: "sf-landmarks-fill",
    type: "fill",
    source: "sf-landmarks",
    filter: ["==", "$type", "Polygon"],
    paint: {
      "fill-color": "#088",
      "fill-opacity": 0.4,
    },
  });

  // Add polygon outline layer
  map.addLayer({
    id: "sf-landmarks-outline",
    type: "line",
    source: "sf-landmarks",
    filter: ["==", "$type", "Polygon"],
    paint: {
      "line-color": "#088",
      "line-width": 2,
    },
  });

  // Add line layer
  map.addLayer({
    id: "sf-landmarks-line",
    type: "line",
    source: "sf-landmarks",
    filter: ["==", "$type", "LineString"],
    paint: {
      "line-color": "#f00",
      "line-width": 3,
      "line-dasharray": [2, 1],
    },
  });

  // Add circle layer for points
  map.addLayer({
    id: "sf-landmarks-points",
    type: "circle",
    source: "sf-landmarks",
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": 8,
      "circle-color": "#ff6600",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });

  // Add labels for points
  map.addLayer({
    id: "sf-landmarks-labels",
    type: "symbol",
    source: "sf-landmarks",
    filter: ["==", "$type", "Point"],
    layout: {
      "text-field": ["get", "name"],
      "text-offset": [0, 1.5],
      "text-anchor": "top",
      "text-size": 12,
    },
    paint: {
      "text-color": "#333",
      "text-halo-color": "#fff",
      "text-halo-width": 1,
    },
  });

  const printControl = new PrintControl({
    position: "top-right",
    collapsed: true,
    filename: "my-map",
    showSizeOptions: true,
    colorbar: {
      enabled: false,
      colormap: "viridis",
      vmin: 0,
      vmax: 100,
      label: "Temperature",
      units: "°C",
      orientation: "vertical",
      position: "bottom-right",
    },
  });

  map.addControl(printControl, "top-right");

  printControl.on("export", (event) => {
    console.log("Map exported:", event.state.filename);
  });

  printControl.on("copy", () => {
    console.log("Map copied to clipboard");
  });

  printControl.on("error", (event) => {
    console.error("Export error:", event.error);
  });
});
