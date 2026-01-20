/**
 * Result of a spatial file conversion to GeoJSON.
 */
export interface ConversionResult {
  /** The converted GeoJSON FeatureCollection. */
  geojson: GeoJSON.FeatureCollection;
  /** Any warnings generated during conversion. */
  warnings: string[];
  /** Metadata about the conversion. */
  metadata: ConversionMetadata;
}

/**
 * Metadata about a file conversion.
 */
export interface ConversionMetadata {
  /** Original file format. */
  originalFormat: string;
  /** Number of features converted. */
  featureCount: number;
  /** Geometry types found in the data. */
  geometryTypes: string[];
  /** Coordinate reference system if detected. */
  crs?: string;
  /** Original file size in bytes. */
  fileSize: number;
  /** Time taken to convert in milliseconds. */
  conversionTimeMs: number;
}

/**
 * Progress callback for conversion operations.
 */
export interface ConversionProgress {
  /** Current stage of the conversion. */
  stage: 'loading' | 'initializing' | 'converting' | 'complete' | 'error';
  /** Progress percentage (0-100). */
  percent?: number;
  /** Human-readable progress message. */
  message?: string;
}

/**
 * Callback type for conversion progress updates.
 */
export type ConversionProgressCallback = (progress: ConversionProgress) => void;

/**
 * Interface for vector file converters.
 */
export interface VectorConverter {
  /**
   * Converts a file buffer to GeoJSON.
   *
   * @param buffer - The file contents as an ArrayBuffer.
   * @param filename - The original filename (used for format detection).
   * @param onProgress - Optional progress callback.
   * @returns Promise resolving to the conversion result.
   */
  convert(
    buffer: ArrayBuffer,
    filename: string,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult>;

  /**
   * Checks if the converter is ready for use.
   *
   * @returns True if initialized and ready.
   */
  isReady(): boolean;

  /**
   * Initializes the converter (e.g., load WASM modules).
   *
   * @param onProgress - Optional progress callback.
   * @returns Promise that resolves when ready.
   */
  initialize(onProgress?: ConversionProgressCallback): Promise<void>;

  /**
   * Disposes of resources used by the converter.
   */
  dispose(): void;
}
