import maplibregl from "maplibre-gl";
import { MinimapControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  const minimapControl = new MinimapControl({
    position: "bottom-left",
    collapsed: false,
    width: 250,
    height: 180,
    zoomOffset: -5,
    interactive: true,
  });

  map.addControl(minimapControl, "bottom-left");

  minimapControl.on("expand", (event) => {
    console.log("Minimap expanded:", event.state);
  });

  minimapControl.on("collapse", (event) => {
    console.log("Minimap collapsed:", event.state);
  });
});
