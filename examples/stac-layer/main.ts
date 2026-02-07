import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { StacLayerControl } from "../../src";
import "../../src/lib/styles/stac-layer.css";
import "../../src/lib/styles/common.css";

const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: [-110.9, 60.95],
  zoom: 8,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), "top-left");

// Add STAC Layer control with a sample STAC item URL pre-filled
const stacControl = new StacLayerControl({
  collapsed: false,
  defaultUrl:
    "https://canada-spot-ortho.s3.amazonaws.com/canada_spot_orthoimages/canada_spot5_orthoimages/S5_2007/S5_11055_6057_20070622/S5_11055_6057_20070622.json",
  loadDefaultUrl: true,
  defaultRescaleMin: 0,
  defaultRescaleMax: 255,
  defaultColormap: "none",
});

map.addControl(stacControl, "top-right");

// Listen for layer events
stacControl.on("stacload", (event) => {
  console.log("STAC item loaded:", event.url);
  console.log("Assets available:", event.state.assets);
});

stacControl.on("layeradd", (event) => {
  console.log("STAC layer added:", event.assetKey, "id:", event.layerId);
});

stacControl.on("layerremove", (event) => {
  console.log("STAC layer removed:", event.layerId);
});

stacControl.on("error", (event) => {
  console.error("STAC layer error:", event.error);
});
