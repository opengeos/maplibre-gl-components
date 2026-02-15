import maplibregl from "maplibre-gl";
import { HtmlGuiControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  // Add the HtmlGuiControl
  const htmlGui = new HtmlGuiControl({
    position: "top-right",
    collapsed: true,
  });

  map.addControl(htmlGui, "top-right");

  // Listen for events
  htmlGui.on("htmladd", (event) => {
    console.log("HTML control added:", event.state);
  });

  htmlGui.on("htmlupdate", (event) => {
    console.log("HTML control updated:", event.state);
  });

  htmlGui.on("htmlremove", () => {
    console.log("HTML control removed");
  });
});
