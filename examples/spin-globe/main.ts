import maplibregl from "maplibre-gl";
import { SpinGlobeControl } from "../../src";

const WORLDCOVER_WMTS =
  "https://services.terrascope.be/wmts/v2?layer=WORLDCOVER_2021_MAP&style=&tilematrixset=EPSG%3A3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix=EPSG%3A3857%3A{z}&TileCol={x}&TileRow={y}";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [0, 20],
  zoom: 1.5,
  maxPitch: 85,
});

map.addControl(new maplibregl.NavigationControl());
map.addControl(new maplibregl.GlobeControl());

const spinControl = new SpinGlobeControl({
  speed: 10,
  spinOnLoad: true,
  pauseOnInteraction: true,
});

map.addControl(spinControl, "top-right");

map.on("load", () => {
  map.addSource("worldcover", {
    type: "raster",
    tiles: [WORLDCOVER_WMTS],
    tileSize: 256,
    attribution: '&copy; <a href="https://esa-worldcover.org">ESA WorldCover 2021</a>',
  });

  map.addLayer({
    id: "worldcover-layer",
    type: "raster",
    source: "worldcover",
    paint: {
      "raster-opacity": 0.8,
    },
  });
});

const statusEl = document.getElementById("status")!;

spinControl.on("spinstart", () => {
  statusEl.textContent = "Status: spinning";
  console.log("Globe spinning started");
});

spinControl.on("spinstop", () => {
  statusEl.textContent = "Status: stopped";
  console.log("Globe spinning stopped");
});

// Speed controls
document.getElementById("slow")!.addEventListener("click", () => {
  spinControl.update({ speed: 5 });
});

document.getElementById("medium")!.addEventListener("click", () => {
  spinControl.update({ speed: 15 });
});

document.getElementById("fast")!.addEventListener("click", () => {
  spinControl.update({ speed: 40 });
});

// Toggle info panel
const infoPanel = document.getElementById("info-panel")!;
document.getElementById("info-toggle")!.addEventListener("click", () => {
  infoPanel.classList.toggle("visible");
});
