import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync } from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin to copy static CDN example (not bundled, so users can view source)
function copyStaticCdnExample(): Plugin {
  return {
    name: "copy-static-cdn-example",
    closeBundle() {
      const srcPath = resolve(__dirname, "examples/cdn/index.html");
      const destDir = resolve(__dirname, "dist-examples/examples/cdn");
      const destPath = resolve(destDir, "index.html");
      mkdirSync(destDir, { recursive: true });
      copyFileSync(srcPath, destPath);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    copyStaticCdnExample(),
    // Polyfill Node.js Buffer for shpjs browser compatibility
    nodePolyfills({
      include: ["buffer"],
      globals: {
        Buffer: true,
      },
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      // Avoid downleveling class fields in maplibre-gl worker bundle (prevents __publicField errors).
      target: "es2022",
    },
  },
  base: "/maplibre-gl-components/",
  build: {
    target: "es2022",
    outDir: "dist-examples",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        basic: resolve(__dirname, "examples/basic/index.html"),
        react: resolve(__dirname, "examples/react/index.html"),
        controlGrid: resolve(__dirname, "examples/control-grid/index.html"),
        controlGridReact: resolve(
          __dirname,
          "examples/control-grid-react/index.html",
        ),
        cogLayer: resolve(__dirname, "examples/cog-layer/index.html"),
        zarrLayer: resolve(__dirname, "examples/zarr-layer/index.html"),
        pmtilesLayer: resolve(__dirname, "examples/pmtiles-layer/index.html"),
        addVector: resolve(__dirname, "examples/add-vector/index.html"),
        stacLayer: resolve(__dirname, "examples/stac-layer/index.html"),
        stacSearch: resolve(__dirname, "examples/stac-search/index.html"),
        measureControl: resolve(
          __dirname,
          "examples/measure-control/index.html",
        ),
        bookmarkControl: resolve(
          __dirname,
          "examples/bookmark-control/index.html",
        ),
        printControl: resolve(
          __dirname,
          "examples/print-control/index.html",
        ),
        viewState: resolve(__dirname, "examples/view-state/index.html"),
        minimapControl: resolve(
          __dirname,
          "examples/minimap-control/index.html",
        ),
        timeSliderControl: resolve(
          __dirname,
          "examples/time-slider-control/index.html",
        ),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
