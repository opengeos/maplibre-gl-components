import maplibregl from "maplibre-gl";
import { TimeSliderControl } from "../../src";

const MONTHS = [
  "2024-01-01",
  "2024-02-01",
  "2024-03-01",
  "2024-04-01",
  "2024-05-01",
  "2024-06-01",
  "2024-07-01",
  "2024-08-01",
  "2024-09-01",
  "2024-10-01",
  "2024-11-01",
  "2024-12-01",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-98.5795, 39.8283],
  zoom: 4,
});

map.on("load", () => {
  const timeSlider = new TimeSliderControl({
    position: "bottom-left",
    collapsed: false,
    values: MONTHS,
    fps: 2,
    loop: true,
    panelWidth: 350,
    formatLabel: (_value, index) => {
      return `${MONTH_NAMES[index]} 2024`;
    },
  });

  map.addControl(timeSlider, "bottom-left");

  timeSlider.on("change", (event) => {
    console.log("Month changed:", event.value, "index:", event.index);
  });

  timeSlider.on("play", () => {
    console.log("Playback started");
  });

  timeSlider.on("pause", () => {
    console.log("Playback paused");
  });
});
