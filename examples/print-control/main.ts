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
  const printControl = new PrintControl({
    position: "top-right",
    collapsed: true,
    filename: "my-map",
    showSizeOptions: true,
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
