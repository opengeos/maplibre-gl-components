import maplibregl from "maplibre-gl";
import { ColorbarGuiControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  // Add the ColorbarGuiControl
  const colorbarGui = new ColorbarGuiControl({
    position: "top-right",
    collapsed: true,
  });

  map.addControl(colorbarGui, "top-right");

  // Listen for events
  colorbarGui.on("colorbaradd", (event) => {
    console.log("Colorbar added:", event.state);
  });

  colorbarGui.on("colorbarupdate", (event) => {
    console.log("Colorbar updated:", event.state);
  });

  colorbarGui.on("colorbarremove", () => {
    console.log("Colorbar removed");
  });
});
