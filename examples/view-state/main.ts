import maplibregl from "maplibre-gl";
import { ViewStateControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-98, 38.5],
  zoom: 4,
  maxPitch: 85,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

map.on("load", () => {
  // Add view state control - panel open by default
  const viewStateControl = new ViewStateControl({
    collapsed: false,
    enableBBox: true,
    precision: 4,
  });
  map.addControl(viewStateControl, "bottom-left");

  // Show drawn bbox in the output panel
  const bboxOutput = document.getElementById("bbox-output");
  const bboxValue = document.getElementById("bbox-value");

  viewStateControl.on("bboxdraw", (event) => {
    if (event.bbox && bboxOutput && bboxValue) {
      bboxOutput.style.display = "block";
      bboxValue.textContent = `[${event.bbox.map((v) => v.toFixed(4)).join(", ")}]`;
    }
  });

  viewStateControl.on("bboxclear", () => {
    if (bboxOutput) {
      bboxOutput.style.display = "none";
    }
  });
});
