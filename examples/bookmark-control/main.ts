import maplibregl from "maplibre-gl";
import { BookmarkControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  // Add the BookmarkControl with localStorage persistence and preloaded bookmarks
  const bookmarkControl = new BookmarkControl({
    position: "top-right",
    collapsed: true,
    storageKey: "maplibre-bookmarks-demo",
    maxBookmarks: 20,
    flyToDuration: 2000,
    generateThumbnails: false,
    bookmarks: [
      {
        id: "san-francisco",
        name: "San Francisco",
        lng: -122.4194,
        lat: 37.7749,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        createdAt: Date.now(),
      },
      {
        id: "new-york",
        name: "New York City",
        lng: -74.006,
        lat: 40.7128,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        createdAt: Date.now(),
      },
      {
        id: "london",
        name: "London",
        lng: -0.1276,
        lat: 51.5074,
        zoom: 11,
        pitch: 0,
        bearing: 0,
        createdAt: Date.now(),
      },
      {
        id: "tokyo",
        name: "Tokyo",
        lng: 139.6917,
        lat: 35.6895,
        zoom: 11,
        pitch: 0,
        bearing: 0,
        createdAt: Date.now(),
      },
      {
        id: "paris",
        name: "Paris",
        lng: 2.3522,
        lat: 48.8566,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        createdAt: Date.now(),
      },
    ],
  });

  map.addControl(bookmarkControl, "top-right");

  // Listen for events
  bookmarkControl.on("add", (event) => {
    console.log("Bookmark added:", event.bookmark);
  });

  bookmarkControl.on("select", (event) => {
    console.log("Navigating to bookmark:", event.bookmark?.name);
  });

  bookmarkControl.on("remove", (event) => {
    console.log("Bookmark removed:", event.bookmark?.name);
  });

  bookmarkControl.on("import", (event) => {
    console.log("Bookmarks imported:", event.state.bookmarks.length, "total");
  });

});
