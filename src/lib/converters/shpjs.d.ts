/**
 * Type declarations for shpjs module.
 * shpjs converts zipped shapefiles to GeoJSON.
 */
declare module 'shpjs' {
  /**
   * Parses a zipped shapefile and returns GeoJSON.
   *
   * @param buffer - ArrayBuffer containing the zipped shapefile
   * @returns Promise resolving to GeoJSON FeatureCollection or array of FeatureCollections
   */
  function shp(
    buffer: ArrayBuffer | string
  ): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;

  export = shp;
}
