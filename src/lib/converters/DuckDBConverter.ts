import type {
  VectorConverter,
  ConversionResult,
  ConversionProgressCallback,
  ConversionMetadata,
} from "./types";

/**
 * DuckDB WASM types (minimal interface for our needs).
 * These are defined here to avoid direct dependency on @duckdb/duckdb-wasm
 * at compile time, since it's an optional dependency.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DuckDBModule = any;

interface DuckDBInstance {
  connect(): Promise<DuckDBConnection>;
  registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
  dropFile(name: string): Promise<void>;
  terminate(): Promise<void>;
  open(config?: Record<string, unknown>): Promise<void>;
}

interface DuckDBConnection {
  query<T = Record<string, unknown>>(sql: string): Promise<{ toArray(): T[] }>;
  close(): Promise<void>;
}

/** Singleton instance of the DuckDB converter. */
let converterInstance: DuckDBConverter | null = null;

/**
 * Gets the singleton DuckDB converter instance.
 *
 * @returns The DuckDB converter instance.
 */
export function getDuckDBConverter(): DuckDBConverter {
  if (!converterInstance) {
    converterInstance = new DuckDBConverter();
  }
  return converterInstance;
}

/**
 * A converter that uses DuckDB WASM with the spatial extension
 * to convert GeoPackage and GeoParquet files to GeoJSON.
 *
 * @example
 * ```typescript
 * const converter = getDuckDBConverter();
 * await converter.initialize();
 *
 * const buffer = await file.arrayBuffer();
 * const result = await converter.convert(buffer, 'data.gpkg');
 * console.log(result.geojson);
 * ```
 */
export class DuckDBConverter implements VectorConverter {
  private _duckdb: DuckDBModule | null = null;
  private _db: DuckDBInstance | null = null;
  private _worker: Worker | null = null;
  private _initialized = false;
  private _initializing = false;
  private _bundleUrl?: string;

  /**
   * Creates a new DuckDBConverter instance.
   *
   * @param bundleUrl - Optional custom URL for DuckDB WASM bundles.
   */
  constructor(bundleUrl?: string) {
    this._bundleUrl = bundleUrl;
  }

  /**
   * Checks if the converter is ready for use.
   *
   * @returns True if initialized and ready.
   */
  isReady(): boolean {
    return this._initialized && this._db !== null;
  }

  /**
   * Initializes DuckDB WASM with the spatial extension.
   *
   * @param onProgress - Optional progress callback.
   */
  async initialize(onProgress?: ConversionProgressCallback): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) {
      // Wait for existing initialization
      while (this._initializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return;
    }

    this._initializing = true;

    try {
      onProgress?.({
        stage: "initializing",
        percent: 0,
        message: "Loading DuckDB WASM...",
      });

      // Dynamically import duckdb-wasm
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let duckdb: any;
      try {
        // Use @vite-ignore to suppress dynamic import warning
        const module = await import(/* @vite-ignore */ "@duckdb/duckdb-wasm");
        // Handle both ESM and CJS module formats
        duckdb = module.default || module;
      } catch (importError) {
        throw new Error(
          `DuckDB WASM is not installed or failed to load. Install it with: npm install @duckdb/duckdb-wasm. Error: ${importError instanceof Error ? importError.message : "Unknown error"}`,
        );
      }
      this._duckdb = duckdb as DuckDBModule;

      onProgress?.({
        stage: "initializing",
        percent: 30,
        message: "Selecting DuckDB bundle...",
      });

      // Get the CDN bundles - use duckdb's built-in method if available
      let bundle;
      if (this._duckdb.getJsDelivrBundles) {
        const bundles = this._duckdb.getJsDelivrBundles();
        bundle = await this._duckdb.selectBundle(bundles);
      } else {
        // Fallback to manual bundles
        const bundles = this._getJsDelivrBundles();
        bundle = await this._duckdb.selectBundle(bundles);
      }

      onProgress?.({
        stage: "initializing",
        percent: 50,
        message: "Instantiating DuckDB...",
      });

      // Create worker and instantiate database
      // DuckDB WASM API: create worker with blob URL to avoid CORS issues
      const logger = new this._duckdb.ConsoleLogger(4); // LogLevel.WARNING

      // Create worker using blob URL pattern (avoids CORS issues with CDN workers)
      let worker: Worker;
      let workerUrl: string | null = null;
      try {
        // Create a blob URL that imports the worker script
        workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], {
            type: "text/javascript",
          }),
        );
        worker = new Worker(workerUrl);
      } catch (workerError) {
        if (workerUrl) URL.revokeObjectURL(workerUrl);
        throw new Error(
          `Failed to create DuckDB worker: ${workerError instanceof Error ? workerError.message : "Unknown error"}`,
        );
      }
      this._worker = worker;

      // Create AsyncDuckDB instance
      const db = new this._duckdb.AsyncDuckDB(logger, worker);

      // Instantiate with the WASM module (and pthread worker if available)
      try {
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      } catch (instantiateError) {
        throw new Error(
          `Failed to instantiate DuckDB: ${instantiateError instanceof Error ? instantiateError.message : "Unknown error"}`,
        );
      }

      // Clean up blob URL
      if (workerUrl) URL.revokeObjectURL(workerUrl);

      this._db = db;

      onProgress?.({
        stage: "initializing",
        percent: 70,
        message: "Loading spatial extension...",
      });

      // Load the spatial extension
      const conn = await this._db!.connect();
      try {
        // Install and load spatial extension
        // In WASM, extensions are loaded from the extension repository
        await conn.query(`INSTALL spatial`);
        await conn.query(`LOAD spatial`);
      } catch (extError) {
        console.warn(
          "Failed to load spatial extension, some features may not work:",
          extError,
        );
        // Continue anyway - some basic functionality might still work
      } finally {
        await conn.close();
      }

      this._initialized = true;

      onProgress?.({
        stage: "initializing",
        percent: 100,
        message: "DuckDB ready",
      });
    } catch (error) {
      onProgress?.({
        stage: "error",
        message: `Failed to initialize DuckDB: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    } finally {
      this._initializing = false;
    }
  }

  /**
   * Gets the jsdelivr bundle URLs for DuckDB WASM.
   */
  private _getJsDelivrBundles(): Record<string, unknown> {
    // Use latest stable version
    const baseUrl =
      this._bundleUrl ||
      "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist";

    return {
      mvp: {
        mainModule: `${baseUrl}/duckdb-mvp.wasm`,
        mainWorker: `${baseUrl}/duckdb-browser-mvp.worker.js`,
      },
      eh: {
        mainModule: `${baseUrl}/duckdb-eh.wasm`,
        mainWorker: `${baseUrl}/duckdb-browser-eh.worker.js`,
      },
    };
  }

  /**
   * Converts a spatial file to GeoJSON using DuckDB.
   *
   * @param buffer - The file contents as an ArrayBuffer.
   * @param filename - The original filename.
   * @param onProgress - Optional progress callback.
   * @returns The conversion result with GeoJSON.
   */
  async convert(
    buffer: ArrayBuffer,
    filename: string,
    onProgress?: ConversionProgressCallback,
  ): Promise<ConversionResult> {
    const startTime = performance.now();
    const format = this._detectFormat(filename);

    // Initialize if needed
    if (!this.isReady()) {
      await this.initialize(onProgress);
    }

    if (!this._db) {
      throw new Error("DuckDB not initialized");
    }

    onProgress?.({
      stage: "loading",
      percent: 0,
      message: `Loading ${filename}...`,
    });

    // Register the file buffer with DuckDB
    const uint8Array = new Uint8Array(buffer);
    await this._db.registerFileBuffer(filename, uint8Array);

    const conn = await this._db.connect();

    try {
      onProgress?.({
        stage: "converting",
        percent: 30,
        message: "Reading spatial data...",
      });

      // Determine how to read the file based on format
      let tableName: string;
      if (format === "geoparquet" || format === "parquet") {
        // For parquet files, use read_parquet
        tableName = `read_parquet('${filename}')`;
      } else {
        // For other spatial formats (GeoPackage, etc.), use ST_Read
        tableName = `ST_Read('${filename}')`;
      }

      // First, get the column info to find geometry column
      const columnsResult = await conn.query<{
        column_name: string;
        column_type: string;
      }>(`
        DESCRIBE SELECT * FROM ${tableName}
      `);
      const columns = columnsResult.toArray();

      // Find geometry column - check for GEOMETRY type or common names
      let geomCol: string | null = null;
      let geomColType: string = "";
      let latCol: string | null = null;
      let lonCol: string | null = null;
      let wktCol: string | null = null;
      const propertyColumns: string[] = [];

      // Common lat/lon column names
      const latNames = ["lat", "latitude", "y", "lat_y", "point_y"];
      const lonNames = [
        "lon",
        "lng",
        "long",
        "longitude",
        "x",
        "lon_x",
        "long_x",
        "point_x",
      ];
      const wktNames = ["wkt", "wkt_geom", "wkt_geometry", "geometry_wkt"];

      for (const col of columns) {
        const colName = col.column_name;
        const colType = col.column_type?.toUpperCase() || "";
        const colNameLower = colName.toLowerCase();

        // Check if this is a geometry column
        const isGeomByType = colType.includes("GEOMETRY");
        const isGeomByName =
          colNameLower === "geom" ||
          colNameLower === "geometry" ||
          colNameLower === "wkb_geometry" ||
          colNameLower === "the_geom" ||
          colNameLower === "shape";
        // BLOB type with geometry-like name might be WKB
        const isWkbBlob = colType.includes("BLOB") && isGeomByName;

        if (isGeomByType || isGeomByName || isWkbBlob) {
          if (!geomCol) {
            geomCol = colName;
            geomColType = colType;
          }
        } else if (latNames.includes(colNameLower) && !latCol) {
          latCol = colName;
          propertyColumns.push(colName);
        } else if (lonNames.includes(colNameLower) && !lonCol) {
          lonCol = colName;
          propertyColumns.push(colName);
        } else if (wktNames.includes(colNameLower) && !wktCol) {
          wktCol = colName;
        } else {
          propertyColumns.push(colName);
        }
      }

      // Determine geometry source: column, WKT, or lat/lon
      let useLatLon = false;
      let useWkt = false;

      if (!geomCol) {
        if (wktCol) {
          // Use WKT column
          useWkt = true;
        } else if (latCol && lonCol) {
          // Use lat/lon columns to create points
          useLatLon = true;
          // Remove lat/lon from property columns (they're used for geometry)
          const latIdx = propertyColumns.indexOf(latCol);
          if (latIdx > -1) propertyColumns.splice(latIdx, 1);
          const lonIdx = propertyColumns.indexOf(lonCol);
          if (lonIdx > -1) propertyColumns.splice(lonIdx, 1);
        } else {
          throw new Error(
            "No geometry column found in the file. For CSV/Excel files, include a geometry column, WKT column, or lat/lon columns.",
          );
        }
      }

      onProgress?.({
        stage: "converting",
        percent: 50,
        message: "Converting to GeoJSON...",
      });

      // Build properties JSON object from non-geometry columns
      const propsExpr =
        propertyColumns.length > 0
          ? `json_object(${propertyColumns.map((c) => `'${c}', "${c}"`).join(", ")})`
          : `'{}'::JSON`;

      // Determine how to convert geometry to GeoJSON based on source type
      let geomExpr: string;
      let whereClause: string;

      if (useLatLon && latCol && lonCol) {
        // Create point geometry from lat/lon columns
        geomExpr = `ST_AsGeoJSON(ST_Point("${lonCol}", "${latCol}"))`;
        whereClause = `"${latCol}" IS NOT NULL AND "${lonCol}" IS NOT NULL`;
      } else if (useWkt && wktCol) {
        // Parse WKT geometry
        geomExpr = `ST_AsGeoJSON(ST_GeomFromText("${wktCol}"))`;
        whereClause = `"${wktCol}" IS NOT NULL AND "${wktCol}" != ''`;
      } else if (geomColType.includes("BLOB")) {
        // WKB stored as BLOB - need to convert from WKB first
        geomExpr = `ST_AsGeoJSON(ST_GeomFromWKB("${geomCol}"))`;
        whereClause = `"${geomCol}" IS NOT NULL`;
      } else {
        // Already a GEOMETRY type - just convert to GeoJSON
        geomExpr = `ST_AsGeoJSON("${geomCol}")`;
        whereClause = `"${geomCol}" IS NOT NULL`;
      }

      // Query to convert each row to a GeoJSON feature
      const result = await conn.query<{ feature: string }>(`
        SELECT json_object(
          'type', 'Feature',
          'geometry', ${geomExpr}::JSON,
          'properties', ${propsExpr}
        ) as feature
        FROM ${tableName}
        WHERE ${whereClause}
      `);

      const rows = result.toArray();

      onProgress?.({
        stage: "converting",
        percent: 80,
        message: "Building feature collection...",
      });

      // Parse features and collect geometry types
      const features: GeoJSON.Feature[] = [];
      const geometryTypes = new Set<string>();

      for (const row of rows) {
        if (row.feature) {
          try {
            const feature =
              typeof row.feature === "string"
                ? JSON.parse(row.feature)
                : row.feature;
            features.push(feature);
            if (feature.geometry?.type) {
              geometryTypes.add(feature.geometry.type);
            }
          } catch (e) {
            console.warn("Failed to parse feature:", e);
          }
        }
      }

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      const endTime = performance.now();

      const metadata: ConversionMetadata = {
        originalFormat: format,
        featureCount: features.length,
        geometryTypes: Array.from(geometryTypes),
        fileSize: buffer.byteLength,
        conversionTimeMs: Math.round(endTime - startTime),
      };

      onProgress?.({
        stage: "complete",
        percent: 100,
        message: `Converted ${features.length} features`,
      });

      return {
        geojson,
        warnings: [],
        metadata,
      };
    } catch (error) {
      onProgress?.({
        stage: "error",
        message: `Failed to convert: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    } finally {
      // Clean up
      await conn.close();
      try {
        await this._db!.dropFile(filename);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Detects the file format from the filename.
   *
   * @param filename - The filename to check.
   * @returns The detected format name.
   */
  private _detectFormat(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "gpkg":
        return "geopackage";
      case "parquet":
      case "geoparquet":
        return "geoparquet";
      case "shp":
        return "shapefile";
      case "geojson":
      case "json":
        return "geojson";
      case "kml":
        return "kml";
      case "kmz":
        return "kmz";
      case "gpx":
        return "gpx";
      case "fgb":
        return "flatgeobuf";
      case "gml":
        return "gml";
      case "topojson":
        return "topojson";
      case "csv":
        return "csv";
      case "xlsx":
      case "xls":
        return "xlsx";
      case "dxf":
        return "dxf";
      default:
        return "unknown";
    }
  }

  /**
   * Disposes of DuckDB resources.
   */
  dispose(): void {
    if (this._db) {
      this._db.terminate().catch(console.error);
      this._db = null;
    }
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._initialized = false;
    this._duckdb = null;

    // Clear singleton if this is it
    if (converterInstance === this) {
      converterInstance = null;
    }
  }
}
