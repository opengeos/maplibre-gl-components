import maplibregl from "maplibre-gl";
import { LegendGuiControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  // Add some sample layers for the legend to describe
  map.addSource("sf-areas", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { type: "residential", name: "Sunset District" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-122.51, 37.755],
                [-122.47, 37.755],
                [-122.47, 37.765],
                [-122.51, 37.765],
                [-122.51, 37.755],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { type: "commercial", name: "Financial District" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-122.405, 37.79],
                [-122.395, 37.79],
                [-122.395, 37.798],
                [-122.405, 37.798],
                [-122.405, 37.79],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { type: "park", name: "Golden Gate Park" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-122.511, 37.769],
                [-122.453, 37.769],
                [-122.453, 37.775],
                [-122.511, 37.775],
                [-122.511, 37.769],
              ],
            ],
          },
        },
      ],
    },
  });

  // Residential areas
  map.addLayer({
    id: "residential",
    type: "fill",
    source: "sf-areas",
    filter: ["==", ["get", "type"], "residential"],
    paint: { "fill-color": "#ff6b6b", "fill-opacity": 0.5 },
  });

  // Commercial areas
  map.addLayer({
    id: "commercial",
    type: "fill",
    source: "sf-areas",
    filter: ["==", ["get", "type"], "commercial"],
    paint: { "fill-color": "#4ecdc4", "fill-opacity": 0.5 },
  });

  // Parks
  map.addLayer({
    id: "parks",
    type: "fill",
    source: "sf-areas",
    filter: ["==", ["get", "type"], "park"],
    paint: { "fill-color": "#2ecc71", "fill-opacity": 0.5 },
  });

  // Add the LegendGuiControl
  const legendGui = new LegendGuiControl({
    position: "top-right",
    collapsed: true,
  });

  map.addControl(legendGui, "top-right");

  // Listen for events
  legendGui.on("legendadd", (event) => {
    console.log("Legend added:", event.state);
  });

  legendGui.on("legendupdate", (event) => {
    console.log("Legend updated:", event.state);
  });

  legendGui.on("legendremove", () => {
    console.log("Legend removed");
  });
});
