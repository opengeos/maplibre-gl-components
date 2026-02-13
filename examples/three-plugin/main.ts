import maplibregl from "maplibre-gl";
import { LayerControl } from "maplibre-gl-layer-control";
import type { CustomLayerAdapter, LayerState } from "maplibre-gl-layer-control";
import { MapScene, SceneTransform, Sun } from "../../src";
import * as THREE from "three";
import "maplibre-gl/dist/maplibre-gl.css";
import "maplibre-gl-layer-control/style.css";

const center: [number, number] = [-122.4194, 37.7749];

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const THREE_LAYER_ID = "map_scene_layer";

class ThreeSceneAdapter implements CustomLayerAdapter {
  type = "three-scene";
  private visible = true;
  private opacity = 1;
  private onChangeCb: ((event: "add" | "remove", layerId: string) => void) | null = null;
  private intervalId: number | null = null;

  constructor(private map: maplibregl.Map, private scene: MapScene) {}

  getLayerIds(): string[] {
    return this.map.getLayer(THREE_LAYER_ID) ? [THREE_LAYER_ID] : [];
  }

  getLayerState(layerId: string): LayerState | null {
    if (layerId !== THREE_LAYER_ID || !this.map.getLayer(THREE_LAYER_ID)) return null;
    return {
      visible: this.visible,
      opacity: this.opacity,
      name: "Three Scene",
      isCustomLayer: true,
      customLayerType: "custom-fill",
    };
  }

  setVisibility(layerId: string, visible: boolean): void {
    if (layerId !== THREE_LAYER_ID) return;
    this.visible = visible;
    this.scene.world.visible = visible;
    this.scene.lights.visible = visible;
    this.map.triggerRepaint();
  }

  setOpacity(layerId: string, opacity: number): void {
    if (layerId !== THREE_LAYER_ID) return;
    this.opacity = opacity;

    this.scene.world.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const m = material as THREE.Material & { opacity?: number; transparent?: boolean };
        if ("opacity" in m) {
          m.opacity = opacity;
          m.transparent = opacity < 1;
          m.needsUpdate = true;
        }
      }
    });

    this.map.triggerRepaint();
  }

  getName(_layerId: string): string {
    return "Three Scene";
  }

  getSymbolType(_layerId: string): string {
    return "custom-fill";
  }

  onLayerChange(callback: (event: "add" | "remove", layerId: string) => void): () => void {
    this.onChangeCb = callback;

    const notifyIfReady = () => {
      if (this.map.getLayer(THREE_LAYER_ID) && this.onChangeCb) {
        this.onChangeCb("add", THREE_LAYER_ID);
        return true;
      }
      return false;
    };

    // Try immediately, then poll briefly until MapScene injects the custom layer.
    if (!notifyIfReady()) {
      this.intervalId = window.setInterval(() => {
        if (notifyIfReady() && this.intervalId !== null) {
          window.clearInterval(this.intervalId);
          this.intervalId = null;
        }
      }, 100);
    }

    return () => {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.onChangeCb = null;
    };
  }
}

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
    basemapStyleUrl: BASEMAP_STYLE,
    layers: [],
  });
  map.addControl(layerControl, "top-right");

  const scene = new MapScene(map as unknown as any, {
    preserveDrawingBuffer: false,
  });
  layerControl.registerCustomAdapter(new ThreeSceneAdapter(map, scene));
  map.triggerRepaint();

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
