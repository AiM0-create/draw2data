import type { Feature } from '../../types';

// Use multiple Overpass endpoints for resilience
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
}

function buildOverpassQuery(datasetIds: string[], bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  // Build a single combined query for all datasets to minimize API calls
  const parts: string[] = [];

  for (const id of datasetIds) {
    switch (id) {
      case 'buildings':
        parts.push(`way["building"](${bboxStr})`, `relation["building"](${bboxStr})`);
        break;
      case 'places':
        parts.push(
          `node["amenity"](${bboxStr})`,
          `node["shop"](${bboxStr})`,
          `node["tourism"](${bboxStr})`,
          `node["leisure"](${bboxStr})`
        );
        break;
      case 'transportation':
        parts.push(`way["highway"](${bboxStr})`);
        break;
    }
  }

  return `[out:json][timeout:90];(${parts.join(';')};);out geom;`;
}

function elementToFeature(element: OverpassElement): Feature | null {
  if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [element.lon, element.lat],
      },
      properties: {
        id: `node/${element.id}`,
        ...element.tags,
      },
    };
  }

  if (element.type === 'way' && element.geometry) {
    const coords = element.geometry.map((p) => [p.lon, p.lat]);

    const first = coords[0];
    const last = coords[coords.length - 1];
    const isClosed = first[0] === last[0] && first[1] === last[1] && coords.length >= 4;

    if (isClosed) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
        properties: {
          id: `way/${element.id}`,
          ...element.tags,
        },
      };
    } else {
      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
        properties: {
          id: `way/${element.id}`,
          ...element.tags,
        },
      };
    }
  }

  if (element.type === 'relation' && element.members) {
    const outerRings: number[][][] = [];

    for (const member of element.members) {
      if (member.role === 'outer' && member.geometry) {
        const ring = member.geometry.map((p) => [p.lon, p.lat]);
        outerRings.push(ring);
      }
    }

    if (outerRings.length === 0) return null;

    if (outerRings.length === 1) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: outerRings,
        },
        properties: {
          id: `relation/${element.id}`,
          ...element.tags,
        },
      };
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: outerRings.map((ring) => [ring]),
      },
      properties: {
        id: `relation/${element.id}`,
        ...element.tags,
      },
    };
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  query: string,
  onProgress?: (msg: string) => void
): Promise<OverpassElement[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Cycle through endpoints on retries
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];

    if (attempt > 0) {
      const waitMs = RETRY_DELAY_MS * attempt;
      onProgress?.(`Rate limited. Retrying in ${waitMs / 1000}s... (attempt ${attempt + 1})`);
      await delay(waitMs);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 || response.status === 504) {
        lastError = new Error(
          response.status === 429
            ? 'Rate limit reached'
            : 'Query timed out'
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Network errors get retried too
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw new Error(
    lastError?.message === 'Rate limit reached'
      ? 'Overpass API rate limit reached after retries. Please wait 30 seconds and try again, or draw a smaller area.'
      : lastError?.message === 'Query timed out'
        ? 'Query timed out. Try a smaller area or fewer datasets.'
        : `Overpass API error: ${lastError?.message}`
  );
}

export async function queryOverpassCombined(
  datasetIds: string[],
  bbox: [number, number, number, number],
  onProgress?: (msg: string) => void
): Promise<Feature[]> {
  const query = buildOverpassQuery(datasetIds, bbox);

  onProgress?.(`Querying OpenStreetMap for ${datasetIds.join(', ')}...`);

  const elements = await fetchWithRetry(query, onProgress);

  onProgress?.(`Processing ${elements.length} features...`);

  const features: Feature[] = [];
  for (const element of elements) {
    const feature = elementToFeature(element);
    if (feature) {
      features.push(feature);
    }
  }

  return features;
}
