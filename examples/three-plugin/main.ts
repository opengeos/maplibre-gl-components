import maplibregl from "maplibre-gl";
import { LayerControl } from "maplibre-gl-layer-control";
import { MapScene, SceneTransform, Sun } from "../../src";
import * as THREE from "three";
import "maplibre-gl/dist/maplibre-gl.css";
import "maplibre-gl-layer-control/style.css";

const center: [number, number] = [-122.4194, 37.7749];

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP_STYLE,
  center,
  zoom: 16,
  pitch: 60,
  bearing: 30,
  antialias: true,
});

map.on("load", () => {
  const layerControl = new LayerControl({
    collapsed: false,
    layers: ["map_scene_layer"],
    basemapStyleUrl: BASEMAP_STYLE,
  });
  map.addControl(layerControl, "top-right");

  const scene = new MapScene(map as unknown as any, {
    preserveDrawingBuffer: false,
  });

  const geometry = new THREE.BoxGeometry(30, 30, 30);
  const material = new THREE.MeshStandardMaterial({
    color: "#e63946",
    roughness: 0.55,
    metalness: 0.2,
  });
  const cube = new THREE.Mesh(geometry, material);

  const mercatorPosition = SceneTransform.lngLatToVector3(center[0], center[1], 50);
  cube.position.set(mercatorPosition.x, mercatorPosition.y, mercatorPosition.z);

  scene.addObject(cube);

  const sun = new Sun();
  scene.addLight(sun as unknown as any);

  scene.on("render", () => {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.013;
  });
});
