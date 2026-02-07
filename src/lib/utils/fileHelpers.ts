/**
 * Supported vector file formats.
 *
 * DuckDB's spatial extension uses GDAL under the hood, enabling support
 * for many common geospatial formats via ST_Read().
 */
export type VectorFormat =
  | "geojson"
  | "shapefile"
  | "geopackage"
  | "geoparquet"
  | "kml"
  | "kmz"
  | "gpx"
  | "flatgeobuf"
  | "gml"
  | "topojson"
  | "csv"
  | "xlsx"
  | "dxf"
  | "unknown";

/**
 * File extensions for GeoJSON files.
 */
export const GEOJSON_EXTENSIONS = [".geojson", ".json"];

/**
 * File extensions for Shapefile files.
 * Includes .zip for zipped shapefiles (most common distribution).
 */
export const SHAPEFILE_EXTENSIONS = [".shp", ".zip"];

/**
 * File extensions for GeoPackage files.
 */
export const GEOPACKAGE_EXTENSIONS = [".gpkg"];

/**
 * File extensions for GeoParquet files.
 */
export const GEOPARQUET_EXTENSIONS = [".parquet", ".geoparquet"];

/**
 * File extensions for KML (Keyhole Markup Language) files.
 * Used by Google Earth.
 */
export const KML_EXTENSIONS = [".kml"];

/**
 * File extensions for KMZ (compressed KML) files.
 * KMZ is a zipped KML file used by Google Earth.
 */
export const KMZ_EXTENSIONS = [".kmz"];

/**
 * File extensions for GPX (GPS Exchange Format) files.
 * Common format for GPS tracks, waypoints, and routes.
 */
export const GPX_EXTENSIONS = [".gpx"];

/**
 * File extensions for FlatGeobuf files.
 * A performant binary encoding for geographic data.
 */
export const FLATGEOBUF_EXTENSIONS = [".fgb"];

/**
 * File extensions for GML (Geography Markup Language) files.
 * OGC standard XML-based format.
 */
export const GML_EXTENSIONS = [".gml"];

/**
 * File extensions for TopoJSON files.
 * An extension of GeoJSON that encodes topology.
 */
export const TOPOJSON_EXTENSIONS = [".topojson"];

/**
 * File extensions for CSV files with geometry.
 * Can contain WKT geometry or lat/lon columns.
 */
export const CSV_EXTENSIONS = [".csv"];

/**
 * File extensions for Excel files with geometry.
 * Can contain WKT geometry or lat/lon columns.
 */
export const XLSX_EXTENSIONS = [".xlsx", ".xls"];

/**
 * File extensions for DXF (AutoCAD Drawing Exchange Format) files.
 */
export const DXF_EXTENSIONS = [".dxf"];

/**
 * Extensions processed via shpjs (Shapefile library).
 */
export const SHPJS_EXTENSIONS = [...SHAPEFILE_EXTENSIONS];

/**
 * Extensions processed via DuckDB spatial (GDAL-powered).
 */
export const DUCKDB_EXTENSIONS = [
  ...GEOPACKAGE_EXTENSIONS,
  ...GEOPARQUET_EXTENSIONS,
  ...KML_EXTENSIONS,
  ...KMZ_EXTENSIONS,
  ...GPX_EXTENSIONS,
  ...FLATGEOBUF_EXTENSIONS,
  ...GML_EXTENSIONS,
  ...TOPOJSON_EXTENSIONS,
  ...CSV_EXTENSIONS,
  ...XLSX_EXTENSIONS,
  ...DXF_EXTENSIONS,
];

/**
 * All supported extensions for advanced formats (require DuckDB or shpjs).
 */
export const ADVANCED_EXTENSIONS = [...SHPJS_EXTENSIONS, ...DUCKDB_EXTENSIONS];

/**
 * All supported vector file extensions.
 */
export const ALL_EXTENSIONS = [...GEOJSON_EXTENSIONS, ...ADVANCED_EXTENSIONS];

/**
 * Detects the vector format from a filename.
 *
 * @param filename - The filename to check.
 * @returns The detected vector format.
 *
 * @example
 * ```typescript
 * detectFormat('data.geojson'); // 'geojson'
 * detectFormat('counties.shp'); // 'shapefile'
 * detectFormat('data.gpkg'); // 'geopackage'
 * detectFormat('track.gpx'); // 'gpx'
 * detectFormat('places.kml'); // 'kml'
 * detectFormat('data.zip'); // 'shapefile'
 * detectFormat('data.txt'); // 'unknown'
 * ```
 */
export function detectFormat(filename: string): VectorFormat {
  const ext = getFileExtension(filename);

  if (GEOJSON_EXTENSIONS.includes(ext)) {
    return "geojson";
  }

  if (SHAPEFILE_EXTENSIONS.includes(ext)) {
    return "shapefile";
  }

  if (GEOPACKAGE_EXTENSIONS.includes(ext)) {
    return "geopackage";
  }

  if (GEOPARQUET_EXTENSIONS.includes(ext)) {
    return "geoparquet";
  }

  if (KML_EXTENSIONS.includes(ext)) {
    return "kml";
  }

  if (KMZ_EXTENSIONS.includes(ext)) {
    return "kmz";
  }

  if (GPX_EXTENSIONS.includes(ext)) {
    return "gpx";
  }

  if (FLATGEOBUF_EXTENSIONS.includes(ext)) {
    return "flatgeobuf";
  }

  if (GML_EXTENSIONS.includes(ext)) {
    return "gml";
  }

  if (TOPOJSON_EXTENSIONS.includes(ext)) {
    return "topojson";
  }

  if (CSV_EXTENSIONS.includes(ext)) {
    return "csv";
  }

  if (XLSX_EXTENSIONS.includes(ext)) {
    return "xlsx";
  }

  if (DXF_EXTENSIONS.includes(ext)) {
    return "dxf";
  }

  return "unknown";
}

/**
 * Checks if a format requires DuckDB for processing.
 * Note: Shapefiles use shpjs, not DuckDB.
 *
 * @param format - The vector format to check.
 * @returns True if the format requires DuckDB.
 *
 * @example
 * ```typescript
 * requiresDuckDB('geojson'); // false
 * requiresDuckDB('shapefile'); // false (uses shpjs)
 * requiresDuckDB('geopackage'); // true
 * requiresDuckDB('geoparquet'); // true
 * requiresDuckDB('kml'); // true
 * requiresDuckDB('gpx'); // true
 * ```
 */
export function requiresDuckDB(format: VectorFormat): boolean {
  return (
    format === "geopackage" ||
    format === "geoparquet" ||
    format === "kml" ||
    format === "kmz" ||
    format === "gpx" ||
    format === "flatgeobuf" ||
    format === "gml" ||
    format === "topojson" ||
    format === "csv" ||
    format === "xlsx" ||
    format === "dxf"
  );
}

/**
 * Checks if a format requires a special converter (not native GeoJSON).
 *
 * @param format - The vector format to check.
 * @returns True if the format requires conversion.
 */
export function requiresConversion(format: VectorFormat): boolean {
  return format !== "geojson" && format !== "unknown";
}

/**
 * Gets the file extension from a filename (lowercase, with leading dot).
 *
 * @param filename - The filename to extract extension from.
 * @returns The file extension (e.g., '.geojson') or empty string.
 *
 * @example
 * ```typescript
 * getFileExtension('data.GeoJSON'); // '.geojson'
 * getFileExtension('file.tar.gz'); // '.gz'
 * getFileExtension('noextension'); // ''
 * ```
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Reads a File object as an ArrayBuffer.
 *
 * @param file - The file to read.
 * @returns Promise resolving to the file contents as ArrayBuffer.
 *
 * @example
 * ```typescript
 * const input = document.querySelector('input[type="file"]');
 * const file = input.files[0];
 * const buffer = await readFileAsBuffer(file);
 * ```
 */
export function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * Gets the list of accepted file extensions based on options.
 *
 * @param enableAdvanced - Whether to include advanced format extensions.
 * @returns Array of accepted file extensions.
 *
 * @example
 * ```typescript
 * getAcceptedExtensions(false); // ['.geojson', '.json']
 * getAcceptedExtensions(true); // ['.geojson', '.json', '.shp', '.zip', '.gpkg', '.kml', ...]
 * ```
 */
export function getAcceptedExtensions(enableAdvanced: boolean): string[] {
  if (enableAdvanced) {
    return ALL_EXTENSIONS;
  }
  return GEOJSON_EXTENSIONS;
}

/**
 * Checks if a file extension is valid for the given options.
 *
 * @param filename - The filename to check.
 * @param enableAdvanced - Whether advanced formats are enabled.
 * @returns True if the extension is accepted.
 *
 * @example
 * ```typescript
 * isValidExtension('data.geojson', false); // true
 * isValidExtension('data.gpkg', false); // false
 * isValidExtension('data.gpkg', true); // true
 * isValidExtension('track.gpx', true); // true
 * ```
 */
export function isValidExtension(
  filename: string,
  enableAdvanced: boolean,
): boolean {
  const ext = getFileExtension(filename);
  const accepted = getAcceptedExtensions(enableAdvanced);
  return accepted.includes(ext);
}

/**
 * Gets a human-readable format name for display.
 *
 * @param format - The vector format.
 * @returns Human-readable format name.
 *
 * @example
 * ```typescript
 * getFormatDisplayName('geojson'); // 'GeoJSON'
 * getFormatDisplayName('shapefile'); // 'Shapefile'
 * getFormatDisplayName('kml'); // 'KML'
 * getFormatDisplayName('gpx'); // 'GPX'
 * ```
 */
export function getFormatDisplayName(format: VectorFormat): string {
  switch (format) {
    case "geojson":
      return "GeoJSON";
    case "shapefile":
      return "Shapefile";
    case "geopackage":
      return "GeoPackage";
    case "geoparquet":
      return "GeoParquet";
    case "kml":
      return "KML";
    case "kmz":
      return "KMZ";
    case "gpx":
      return "GPX";
    case "flatgeobuf":
      return "FlatGeobuf";
    case "gml":
      return "GML";
    case "topojson":
      return "TopoJSON";
    case "csv":
      return "CSV";
    case "xlsx":
      return "Excel";
    case "dxf":
      return "DXF";
    default:
      return "Unknown";
  }
}

/**
 * Gets a description of the format for tooltips/help text.
 *
 * @param format - The vector format.
 * @returns Description of the format.
 */
export function getFormatDescription(format: VectorFormat): string {
  switch (format) {
    case "geojson":
      return "GeoJSON - Open standard format for geographic data";
    case "shapefile":
      return "Shapefile - Esri vector data format (.shp or .zip)";
    case "geopackage":
      return "GeoPackage - OGC standard SQLite-based format";
    case "geoparquet":
      return "GeoParquet - Columnar format for geospatial data";
    case "kml":
      return "KML - Keyhole Markup Language (Google Earth)";
    case "kmz":
      return "KMZ - Compressed KML (Google Earth)";
    case "gpx":
      return "GPX - GPS Exchange Format for tracks and waypoints";
    case "flatgeobuf":
      return "FlatGeobuf - Fast binary encoding for geographic data";
    case "gml":
      return "GML - Geography Markup Language (OGC standard)";
    case "topojson":
      return "TopoJSON - Topology-encoded GeoJSON extension";
    case "csv":
      return "CSV - Comma-separated values with geometry (WKT or lat/lon)";
    case "xlsx":
      return "Excel - Spreadsheet with geometry (WKT or lat/lon)";
    case "dxf":
      return "DXF - AutoCAD Drawing Exchange Format";
    default:
      return "Unknown format";
  }
}
