import type { BasemapItem } from "../core/types";

/**
 * Default URL for xyzservices providers.json.
 */
export const XYZSERVICES_URL =
  "https://raw.githubusercontent.com/geopandas/xyzservices/main/xyzservices/data/providers.json";

/**
 * XYZservices provider structure from providers.json.
 */
interface XYZProvider {
  url: string;
  name: string;
  max_zoom?: number;
  min_zoom?: number;
  attribution?: string;
  html_attribution?: string;
  bounds?: [[number, number], [number, number]];
  accessToken?: string;
  variant?: string;
  ext?: string;
  subdomains?: string;
  status?: string;
}

/**
 * Parsed provider group from xyzservices.
 */
interface ProviderGroup {
  [key: string]: XYZProvider | ProviderGroup;
}

/**
 * Options for parsing providers.
 */
interface ParseOptions {
  filterGroups?: string[];
  excludeGroups?: string[];
  excludeBroken?: boolean;
}

/**
 * Check if an object is an XYZ provider (has url field).
 */
function isXYZProvider(obj: unknown): obj is XYZProvider {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "url" in obj &&
    typeof (obj as XYZProvider).url === "string"
  );
}

/**
 * Build the tile URL from an XYZ provider.
 * Replaces placeholders like {s}, {r}, {variant}, {ext}.
 */
export function buildTileUrl(basemap: BasemapItem): string {
  let url = basemap.url || "";

  // Replace subdomains placeholder with 'a' (first subdomain)
  url = url.replace("{s}", "a");

  // Replace retina placeholder
  url = url.replace("{r}", "");

  // Replace variant placeholder (e.g., CartoDB uses {variant} for 'light_all', 'dark_all', etc.)
  if (basemap.variant) {
    url = url.replace("{variant}", basemap.variant);
  }

  // Replace file extension placeholder (e.g., some providers use {ext} for 'png', 'jpg')
  if (basemap.ext) {
    url = url.replace("{ext}", basemap.ext);
  }

  // Handle API key placeholders
  if (basemap.apiKey) {
    url = url.replace("{apikey}", basemap.apiKey);
    url = url.replace("{accessToken}", basemap.apiKey);
    url = url.replace("<insert your api key here>", basemap.apiKey);
    url = url.replace("<insert your access token here>", basemap.apiKey);
  }

  return url;
}

/**
 * Generate a thumbnail URL from a basemap's tile URL.
 * Uses zoom level 3 for a reasonable world view.
 */
export function generateThumbnailUrl(basemap: BasemapItem): string {
  if (basemap.thumbnail) {
    return basemap.thumbnail;
  }

  if (basemap.url) {
    let url = buildTileUrl(basemap);
    // Generate thumbnail at zoom 3, tile 4/2 (roughly centered on Europe)
    url = url.replace("{z}", "3");
    url = url.replace("{x}", "4");
    url = url.replace("{y}", "2");
    return url;
  }

  return "";
}

/**
 * Parse xyzservices providers.json data into BasemapItem array.
 */
export function parseProviders(
  data: Record<string, unknown>,
  options: ParseOptions = {},
): BasemapItem[] {
  const { filterGroups, excludeGroups, excludeBroken = true } = options;
  const basemaps: BasemapItem[] = [];

  function processProvider(
    provider: XYZProvider,
    groupName: string,
    providerName: string,
  ): void {
    // Skip broken providers
    if (excludeBroken && provider.status === "broken") {
      return;
    }

    // Skip providers without URL
    if (!provider.url) {
      return;
    }

    // Check if requires API key
    const requiresApiKey =
      provider.accessToken?.includes("insert your") ||
      provider.url.includes("{apikey}") ||
      provider.url.includes("{accessToken}");

    basemaps.push({
      id: provider.name || `${groupName}.${providerName}`,
      name: providerName,
      group: groupName,
      url: provider.url,
      attribution: provider.html_attribution || provider.attribution,
      maxZoom: provider.max_zoom,
      minZoom: provider.min_zoom,
      requiresApiKey,
      variant: provider.variant,
      ext: provider.ext,
    });
  }

  function processGroup(group: ProviderGroup, groupName: string): void {
    for (const [key, value] of Object.entries(group)) {
      if (isXYZProvider(value)) {
        processProvider(value, groupName, key);
      }
    }
  }

  for (const [groupName, groupValue] of Object.entries(data)) {
    // Apply group filtering
    if (excludeGroups?.includes(groupName)) {
      continue;
    }
    if (filterGroups?.length && !filterGroups.includes(groupName)) {
      continue;
    }

    // Check if this is a direct provider or a group of providers
    if (isXYZProvider(groupValue)) {
      // Direct provider (like OpenSeaMap)
      processProvider(groupValue, groupName, groupName);
    } else if (typeof groupValue === "object" && groupValue !== null) {
      // Group of providers (like OpenStreetMap with Mapnik, HOT, etc.)
      processGroup(groupValue as ProviderGroup, groupName);
    }
  }

  return basemaps;
}

/**
 * Fetch and parse providers from xyzservices URL.
 */
export async function fetchProviders(
  url: string = XYZSERVICES_URL,
  options: ParseOptions = {},
): Promise<BasemapItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch providers: ${response.statusText}`);
  }
  const data = await response.json();
  return parseProviders(data, options);
}

/**
 * Group basemaps by their group property.
 */
export function groupBasemaps(
  basemaps: BasemapItem[],
): Map<string, BasemapItem[]> {
  const groups = new Map<string, BasemapItem[]>();

  for (const basemap of basemaps) {
    const groupName = basemap.group || "Other";
    const existing = groups.get(groupName) || [];
    existing.push(basemap);
    groups.set(groupName, existing);
  }

  return groups;
}

/**
 * Filter basemaps by search text.
 */
export function filterBasemaps(
  basemaps: BasemapItem[],
  searchText: string,
): BasemapItem[] {
  if (!searchText.trim()) {
    return basemaps;
  }

  const search = searchText.toLowerCase();
  return basemaps.filter(
    (b) =>
      b.name.toLowerCase().includes(search) ||
      b.id.toLowerCase().includes(search) ||
      b.group?.toLowerCase().includes(search),
  );
}

/**
 * Google basemap definitions.
 * These are not included in xyzservices but are commonly requested.
 */
export const GOOGLE_BASEMAPS: BasemapItem[] = [
  {
    id: "Google.Roadmap",
    name: "Roadmap",
    group: "Google",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    maxZoom: 22,
  },
  {
    id: "Google.Satellite",
    name: "Satellite",
    group: "Google",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    maxZoom: 22,
  },
  {
    id: "Google.Terrain",
    name: "Terrain",
    group: "Google",
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    maxZoom: 22,
  },
  {
    id: "Google.Hybrid",
    name: "Hybrid",
    group: "Google",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    maxZoom: 22,
  },
];
