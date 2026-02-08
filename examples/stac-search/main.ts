import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { StacSearchControl } from "../../src";
import "../../src/lib/styles/stac-search.css";
import "../../src/lib/styles/common.css";

const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center: [-122.4, 37.8], // San Francisco Bay Area
  zoom: 9,
});

// Add navigation control
map.addControl(new maplibregl.NavigationControl(), "top-left");

// Add STAC Search control with default catalogs
const stacSearch = new StacSearchControl({
  collapsed: false,
  catalogs: [
    {
      name: "Element84 Earth Search",
      url: "https://earth-search.aws.element84.com/v1",
    },
    {
      name: "Microsoft Planetary Computer",
      url: "https://planetarycomputer.microsoft.com/api/stac/v1",
    },
  ],
  maxItems: 20,
  defaultRescaleMin: 0,
  defaultRescaleMax: 10000,
  showFootprints: true,
});

map.addControl(stacSearch, "top-right");

// Listen for search events
stacSearch.on("catalogselect", (event) => {
  console.log("Catalog selected:", event.catalog?.name);
});

stacSearch.on("collectionsload", (event) => {
  console.log("Collections loaded:", event.state.collections.length);
});

stacSearch.on("collectionselect", (event) => {
  console.log("Collection selected:", event.collection?.id);
});

stacSearch.on("search", (event) => {
  console.log("Search completed:", event.state.items.length, "items found");
});

stacSearch.on("itemselect", (event) => {
  console.log("Item selected:", event.item?.id, event.item?.datetime);
});

stacSearch.on("display", (event) => {
  console.log("Item displayed:", event.item?.id);
});

stacSearch.on("error", (event) => {
  console.error("STAC Search error:", event.error);
});

// Log instructions
console.log("STAC Search Control loaded!");
console.log("1. Click 'Collections' to fetch available collections");
console.log("2. Select a collection (e.g., sentinel-2-l2a)");
console.log("3. Optionally set date range");
console.log("4. Click 'Search Items' to search within current map bounds");
console.log("5. Select an item and click 'Display Item' to visualize");
