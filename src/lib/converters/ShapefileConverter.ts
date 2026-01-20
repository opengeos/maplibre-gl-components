import type {
  VectorConverter,
  ConversionResult,
  ConversionProgressCallback,
  ConversionMetadata,
} from './types';

/**
 * A converter for Shapefile (ZIP) files to GeoJSON using shpjs.
 *
 * This converter handles zipped shapefiles which contain:
 * - .shp (geometry)
 * - .dbf (attributes)
 * - .shx (index)
 * - .prj (projection - optional)
 *
 * @example
 * ```typescript
 * const converter = new ShapefileConverter();
 * await converter.initialize();
 *
 * const buffer = await file.arrayBuffer();
 * const result = await converter.convert(buffer, 'counties.zip');
 * console.log(result.geojson);
 * ```
 */
export class ShapefileConverter implements VectorConverter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _shpjs: any = null;
  private _initialized = false;

  /**
   * Checks if the converter is ready for use.
   *
   * @returns True if initialized and ready.
   */
  isReady(): boolean {
    return this._initialized && this._shpjs !== null;
  }

  /**
   * Initializes the shpjs library.
   *
   * @param onProgress - Optional progress callback.
   */
  async initialize(onProgress?: ConversionProgressCallback): Promise<void> {
    if (this._initialized) return;

    onProgress?.({
      stage: 'initializing',
      percent: 0,
      message: 'Loading shapefile parser...',
    });

    try {
      // Dynamically import shpjs
      this._shpjs = await import(/* @vite-ignore */ 'shpjs');
      this._initialized = true;

      onProgress?.({
        stage: 'initializing',
        percent: 100,
        message: 'Shapefile parser ready',
      });
    } catch {
      throw new Error(
        'shpjs is not installed. Install it with: npm install shpjs'
      );
    }
  }

  /**
   * Converts a Shapefile (ZIP) to GeoJSON.
   *
   * @param buffer - The ZIP file contents as an ArrayBuffer.
   * @param filename - The original filename.
   * @param onProgress - Optional progress callback.
   * @returns The conversion result with GeoJSON.
   */
  async convert(
    buffer: ArrayBuffer,
    filename: string,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const startTime = performance.now();

    // Initialize if needed
    if (!this.isReady()) {
      await this.initialize(onProgress);
    }

    onProgress?.({
      stage: 'loading',
      percent: 10,
      message: `Loading ${filename}...`,
    });

    try {
      onProgress?.({
        stage: 'converting',
        percent: 30,
        message: 'Parsing shapefile...',
      });

      // shpjs can parse from ArrayBuffer directly
      const shp = this._shpjs.default || this._shpjs;
      const geojson = await shp(buffer);

      onProgress?.({
        stage: 'converting',
        percent: 80,
        message: 'Building feature collection...',
      });

      // shpjs can return a FeatureCollection or an array of FeatureCollections
      // (for multi-layer shapefiles)
      let featureCollection: GeoJSON.FeatureCollection;

      if (Array.isArray(geojson)) {
        // Multiple layers - merge them
        featureCollection = {
          type: 'FeatureCollection',
          features: geojson.flatMap((fc) => fc.features || []),
        };
      } else if (geojson.type === 'FeatureCollection') {
        featureCollection = geojson as GeoJSON.FeatureCollection;
      } else if (geojson.type === 'Feature') {
        featureCollection = {
          type: 'FeatureCollection',
          features: [geojson as GeoJSON.Feature],
        };
      } else {
        // Geometry object
        featureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: geojson as GeoJSON.Geometry,
            },
          ],
        };
      }

      // Collect geometry types
      const geometryTypes = new Set<string>();
      for (const feature of featureCollection.features) {
        if (feature.geometry) {
          geometryTypes.add(feature.geometry.type);
        }
      }

      const endTime = performance.now();

      const metadata: ConversionMetadata = {
        originalFormat: 'shapefile',
        featureCount: featureCollection.features.length,
        geometryTypes: Array.from(geometryTypes),
        fileSize: buffer.byteLength,
        conversionTimeMs: Math.round(endTime - startTime),
      };

      onProgress?.({
        stage: 'complete',
        percent: 100,
        message: `Converted ${featureCollection.features.length} features`,
      });

      return {
        geojson: featureCollection,
        warnings: [],
        metadata,
      };
    } catch (error) {
      onProgress?.({
        stage: 'error',
        message: `Failed to parse shapefile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  }

  /**
   * Disposes of resources (no-op for shpjs).
   */
  dispose(): void {
    this._shpjs = null;
    this._initialized = false;
  }
}

/** Singleton instance */
let shapefileConverterInstance: ShapefileConverter | null = null;

/**
 * Gets the singleton Shapefile converter instance.
 *
 * @returns The Shapefile converter instance.
 */
export function getShapefileConverter(): ShapefileConverter {
  if (!shapefileConverterInstance) {
    shapefileConverterInstance = new ShapefileConverter();
  }
  return shapefileConverterInstance;
}
