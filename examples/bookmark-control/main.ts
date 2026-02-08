import maplibregl from "maplibre-gl";
import { BookmarkControl } from "../../src";

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-122.4194, 37.7749],
  zoom: 12,
});

map.on("load", () => {
  // Add the BookmarkControl with localStorage persistence
  const bookmarkControl = new BookmarkControl({
    position: "top-right",
    collapsed: true,
    storageKey: "maplibre-bookmarks-demo",
    maxBookmarks: 20,
    flyToDuration: 2000,
    generateThumbnails: false,
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

  // Add some sample bookmarks if none exist
  if (bookmarkControl.getBookmarks().length === 0) {
    // Navigate to SF and add bookmark
    map.once("moveend", () => {
      bookmarkControl.addBookmark("San Francisco");
    });
  }
});
