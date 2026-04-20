import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { LayerControl } from "maplibre-gl-layer-control";
import "maplibre-gl-layer-control/style.css";
import { SpinGlobeControl } from "../../src";

const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const USGS_IMAGERY =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";

const MGRS_PMTILES =
  "https://data.source.coop/giswqs/opengeos/MGRS_100km.pmtiles";

const GSW_OCCURRENCE =
  "https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png";

const pmtilesProtocol = new Protocol();
maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: [0, 20],
  zoom: 2.5,
  maxPitch: 85,
});

map.on("style.load", () => {
  map.setProjection({ type: "globe" });
});

map.addControl(new maplibregl.GlobeControl());

const spinControl = new SpinGlobeControl({
  speed: 10,
  spinOnLoad: true,
  pauseOnInteraction: true,
});

map.on("load", () => {
  map.addSource("usgs-imagery", {
    type: "raster",
    tiles: [USGS_IMAGERY],
    tileSize: 256,
    attribution:
      '&copy; <a href="https://basemap.nationalmap.gov/">USGS The National Map: Imagery</a>',
  });

  map.addLayer({
    id: "usgs-imagery-layer",
    type: "raster",
    source: "usgs-imagery",
    paint: {
      "raster-opacity": 1,
    },
  });

  map.addSource("gsw-occurrence", {
    type: "raster",
    tiles: [GSW_OCCURRENCE],
    tileSize: 256,
    maxzoom: 13,
    attribution:
      '&copy; <a href="https://global-surface-water.appspot.com/">EC JRC/Google Global Surface Water</a>',
  });

  map.addLayer({
    id: "gsw-occurrence-layer",
    type: "raster",
    source: "gsw-occurrence",
    paint: {
      "raster-opacity": 0.9,
    },
  });

  map.addSource("mgrs", {
    type: "vector",
    url: `pmtiles://${MGRS_PMTILES}`,
    attribution:
      '&copy; <a href="https://data.source.coop/giswqs/opengeos/">MGRS 100km grid</a>',
  });

  map.addLayer({
    id: "mgrs-outline",
    type: "line",
    source: "mgrs",
    "source-layer": "MGRS_100km",
    paint: {
      "line-color": "#ff3333",
      "line-width": 0.8,
      "line-opacity": 0.9,
    },
  });

  const layerControl = new LayerControl({
    collapsed: true,
    layers: ["usgs-imagery-layer", "gsw-occurrence-layer", "mgrs-outline"],
    layerStates: {
      "usgs-imagery-layer": { name: "USGS Imagery", visible: true, opacity: 1 },
      "gsw-occurrence-layer": {
        name: "Water Occurrence",
        visible: true,
        opacity: 0.9,
      },
      "mgrs-outline": { name: "MGRS 100km Grid", visible: true, opacity: 0.9 },
    },
    panelWidth: 300,
    panelMinWidth: 240,
    panelMaxWidth: 420,
    basemapStyleUrl: BASEMAP_STYLE,
  });

  map.addControl(layerControl, "top-right");
  map.addControl(spinControl, "top-right");
});

spinControl.on("spinstart", () => {
  console.log("Globe spinning started");
});

spinControl.on("spinstop", () => {
  console.log("Globe spinning stopped");
});
