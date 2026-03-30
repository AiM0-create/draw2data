import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parquetMetadataAsync, parquetRead } from 'hyparquet';
import { decompress as decompressZstd } from 'fzstd';

export const config = { maxDuration: 60 };

const compressors = {
  ZSTD: (input: Uint8Array) => decompressZstd(input),
};

const AZURE_STORAGE_BASE = 'https://overturemapswestus2.blob.core.windows.net/release';
const FALLBACK_RELEASE = '2026-03-18.0';
const SOURCE_TIMEOUT_MS = 50_000;
const MAX_BUILDINGS_PER_SOURCE = 10_000;
const MAX_OVERTURE_FEATURES = 5_000;

// ─── Types ──────────────────────────────────────────────────────────

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

type GeoJSONGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPoint'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

type DataSource = 'overture' | 'osm' | 'google' | 'microsoft';

interface SourceResult {
  source: DataSource;
  featureCount: number;
  durationMs: number;
  error?: string;
}

interface DatasetSourceComparison {
  dataset: string;
  winner: DataSource;
  sources: SourceResult[];
}

interface TimedResult {
  features: GeoJSONFeature[];
  durationMs: number;
}

// ─── Overture dataset config ────────────────────────────────────────

interface DatasetDef {
  theme: string;
  type: string;
  columns: string[];
}

const OVERTURE_DATASETS: Record<string, DatasetDef> = {
  buildings: {
    theme: 'buildings',
    type: 'building',
    columns: ['id', 'names', 'class', 'geometry', 'bbox'],
  },
  places: {
    theme: 'places',
    type: 'place',
    columns: ['id', 'names', 'categories', 'confidence', 'geometry', 'bbox'],
  },
  transportation: {
    theme: 'transportation',
    type: 'segment',
    columns: ['id', 'names', 'class', 'subclass', 'geometry', 'bbox'],
  },
  land_use: {
    theme: 'base',
    type: 'land_use',
    columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  },
  water: {
    theme: 'base',
    type: 'water',
    columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  },
  infrastructure: {
    theme: 'base',
    type: 'infrastructure',
    columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  },
  addresses: {
    theme: 'addresses',
    type: 'address',
    columns: ['id', 'number', 'street', 'postcode', 'city', 'geometry', 'bbox'],
  },
};

// ─── Caches (persist across warm invocations) ───────────────────────

interface SpatialEntry {
  bbox: [number, number, number, number];
  file: string;
}
const spatialIndexCache = new Map<string, { entries: SpatialEntry[]; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

let msManifest: Map<string, string> | null = null;
let msManifestLoading: Promise<Map<string, string>> | null = null;

// ─── S2 Geometry (for Google Open Buildings) ────────────────────────

const S2_IJ_TO_POS = [
  [0, 1, 3, 2],
  [0, 3, 1, 2],
  [2, 3, 1, 0],
  [2, 1, 3, 0],
];
const S2_POS_ORIENT_DELTA = [1, 0, 0, 3];

function latLngToS2Token(lat: number, lng: number, level: number): string {
  const latR = (lat * Math.PI) / 180,
    lngR = (lng * Math.PI) / 180;
  const x = Math.cos(latR) * Math.cos(lngR);
  const y = Math.cos(latR) * Math.sin(lngR);
  const z = Math.sin(latR);
  const ax = Math.abs(x),
    ay = Math.abs(y),
    az = Math.abs(z);
  let face: number, u: number, v: number;
  if (ax > ay && ax > az) {
    face = x > 0 ? 0 : 3;
    u = face === 0 ? y / x : z / x;
    v = face === 0 ? z / x : y / x;
  } else if (ay > az) {
    face = y > 0 ? 1 : 4;
    u = face === 1 ? -x / y : z / y;
    v = face === 1 ? z / y : -x / y;
  } else {
    face = z > 0 ? 2 : 5;
    u = face === 2 ? -x / z : -y / z;
    v = face === 2 ? -y / z : -x / z;
  }
  const s = u >= 0 ? 0.5 * Math.sqrt(1 + 3 * u) : 1 - 0.5 * Math.sqrt(1 - 3 * u);
  const t = v >= 0 ? 0.5 * Math.sqrt(1 + 3 * v) : 1 - 0.5 * Math.sqrt(1 - 3 * v);
  const maxC = 1 << level;
  const i = Math.max(0, Math.min(maxC - 1, Math.floor(s * maxC)));
  const j = Math.max(0, Math.min(maxC - 1, Math.floor(t * maxC)));
  let pos = 0,
    orient = face & 1;
  for (let bit = level - 1; bit >= 0; bit--) {
    const ij = (((i >> bit) & 1) << 1) | ((j >> bit) & 1);
    const childPos = S2_IJ_TO_POS[orient][ij];
    pos = (pos << 2) | childPos;
    orient ^= S2_POS_ORIENT_DELTA[childPos];
  }
  const miniId = (face << (2 * level + 1)) | (pos << 1) | 1;
  return miniId.toString(16).replace(/0+$/, '') || '0';
}

function bboxToS2Tokens(
  bbox: [number, number, number, number],
  level: number
): string[] {
  const [west, south, east, north] = bbox;
  const tokens = new Set<string>();
  const cellSize = 180 / (1 << level);
  const step = cellSize * 0.4;
  for (let lat = south - step; lat <= north + step; lat += step) {
    for (let lng = west - step; lng <= east + step; lng += step) {
      tokens.add(
        latLngToS2Token(
          Math.max(-90, Math.min(90, lat)),
          (((lng + 180) % 360) + 360) % 360 - 180,
          level
        )
      );
    }
  }
  return [...tokens];
}

// ─── Quadkey (for Microsoft Buildings) ──────────────────────────────

function latLngToQuadkey(lat: number, lng: number, level: number): string {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const px = ((lng + 180) / 360) * 256 * (1 << level);
  const py =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    (1 << level);
  const tx = Math.max(0, Math.min((1 << level) - 1, Math.floor(px / 256)));
  const ty = Math.max(0, Math.min((1 << level) - 1, Math.floor(py / 256)));
  let qk = '';
  for (let i = level; i > 0; i--) {
    let d = 0;
    const mask = 1 << (i - 1);
    if (tx & mask) d += 1;
    if (ty & mask) d += 2;
    qk += d;
  }
  return qk;
}

function bboxToQuadkeys(
  bbox: [number, number, number, number],
  level: number
): string[] {
  const [west, south, east, north] = bbox;
  const keys = new Set<string>();
  const step = Math.max((east - west) / 3, (north - south) / 3, 0.01);
  for (let lat = south; lat <= north + step / 2; lat += step) {
    for (let lng = west; lng <= east + step / 2; lng += step) {
      keys.add(
        latLngToQuadkey(Math.min(lat, 85), Math.min(lng, east), level)
      );
    }
  }
  return [...keys];
}

// ─── WKT parser (for Google Open Buildings CSV) ─────────────────────

function parseWktPolygon(wkt: string): GeoJSONGeometry | null {
  try {
    if (wkt.startsWith('POLYGON')) {
      const inner = wkt.slice(wkt.indexOf('((') + 2, wkt.lastIndexOf('))'));
      const rings = inner.split('),(').map((ring) =>
        ring
          .replace(/[()]/g, '')
          .split(',')
          .map((pair) => {
            const [x, y] = pair.trim().split(/\s+/).map(Number);
            return [x, y];
          })
      );
      return { type: 'Polygon', coordinates: rings };
    }
    if (wkt.startsWith('MULTIPOLYGON')) {
      const inner = wkt.slice(
        wkt.indexOf('(((') + 3,
        wkt.lastIndexOf(')))')
      );
      const polys = inner.split(')),((').map((poly) =>
        poly.split('),(').map((ring) =>
          ring
            .replace(/[()]/g, '')
            .split(',')
            .map((pair) => {
              const [x, y] = pair.trim().split(/\s+/).map(Number);
              return [x, y];
            })
        )
      );
      return { type: 'MultiPolygon', coordinates: polys };
    }
  } catch {
    /* fall through */
  }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Handler
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Range, Accept-Ranges, Content-Length, Content-Type'
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { datasets, bbox } = req.body as {
      datasets: string[];
      bbox: [number, number, number, number];
    };

    if (!datasets?.length || !bbox || bbox.length !== 4) {
      return res.status(400).json({ error: 'Missing datasets or bbox' });
    }

    // Get Overture release
    let release = FALLBACK_RELEASE;
    try {
      const relRes = await fetch('https://stac.overturemaps.org/catalog.json');
      if (relRes.ok) {
        const cat = (await relRes.json()) as { latest?: string };
        if (cat.latest) release = cat.latest;
      }
    } catch {
      /* use fallback */
    }

    // Process all datasets in parallel (Vercel has no subrequest limit)
    const datasetResults = await Promise.all(
      datasets.map((id) => extractDatasetSmart(id, bbox, release))
    );

    const allFeatures = datasetResults.flatMap((r) => r.features);
    const sourceComparisons = datasetResults.map((r) => r.comparison);

    return res.status(200).json({
      type: 'FeatureCollection',
      features: allFeatures,
      metadata: {
        featureCount: allFeatures.length,
        datasetsQueried: datasets,
        source: 'smart',
        release,
        sourceComparisons,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Smart extraction — all 4 sources enabled
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function extractDatasetSmart(
  datasetId: string,
  bbox: [number, number, number, number],
  release: string
): Promise<{ features: GeoJSONFeature[]; comparison: DatasetSourceComparison }> {
  const allEntries: { name: DataSource; promise: Promise<TimedResult> }[] = [];

  // Overture Maps — re-enabled (no CPU limit on Vercel)
  if (OVERTURE_DATASETS[datasetId]) {
    allEntries.push({
      name: 'overture',
      promise: withTimeout(queryOvertureDataset(datasetId, bbox, release), SOURCE_TIMEOUT_MS),
    });
  }

  // OSM — always queried
  allEntries.push({
    name: 'osm',
    promise: withTimeout(queryOverpassDataset(datasetId, bbox), SOURCE_TIMEOUT_MS),
  });

  // Buildings: also query Google + Microsoft
  if (datasetId === 'buildings') {
    allEntries.push({
      name: 'google',
      promise: withTimeout(queryGoogleBuildings(bbox), SOURCE_TIMEOUT_MS),
    });
    allEntries.push({
      name: 'microsoft',
      promise: withTimeout(queryMicrosoftBuildings(bbox), SOURCE_TIMEOUT_MS),
    });
  }

  const settled = await Promise.allSettled(allEntries.map((s) => s.promise));
  const results = allEntries.map((s, i) => buildSourceResult(s.name, settled[i]));

  return pickWinner(datasetId, allEntries, settled, results);
}

function pickWinner(
  datasetId: string,
  entries: { name: DataSource; promise: Promise<TimedResult> }[],
  settled: PromiseSettledResult<TimedResult>[],
  results: SourceResult[]
): { features: GeoJSONFeature[]; comparison: DatasetSourceComparison } {
  let winnerIdx = -1;
  let maxCount = 0; // Must have >0 features to be a winner
  for (let i = 0; i < results.length; i++) {
    if (!results[i].error && results[i].featureCount > maxCount) {
      maxCount = results[i].featureCount;
      winnerIdx = i;
    }
  }
  if (winnerIdx === -1) {
    // All sources failed or returned 0 features
    return {
      features: [],
      comparison: {
        dataset: datasetId,
        winner: 'none' as DataSource,
        sources: results,
      },
    };
  }
  return {
    features: getFeatures(settled[winnerIdx]),
    comparison: {
      dataset: datasetId,
      winner: entries[winnerIdx].name,
      sources: results,
    },
  };
}

function buildSourceResult(
  source: DataSource,
  settled: PromiseSettledResult<TimedResult>
): SourceResult {
  if (settled.status === 'fulfilled') {
    return {
      source,
      featureCount: settled.value.features.length,
      durationMs: settled.value.durationMs,
    };
  }
  return {
    source,
    featureCount: 0,
    durationMs: 0,
    error:
      settled.reason instanceof Error
        ? settled.reason.message
        : String(settled.reason),
  };
}

function getFeatures(
  settled: PromiseSettledResult<TimedResult>
): GeoJSONFeature[] {
  return settled.status === 'fulfilled' ? settled.value.features : [];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Source timeout (${ms}ms)`)), ms)
    ),
  ]);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Overture Maps extraction (GeoParquet on Azure)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function queryOvertureDataset(
  datasetId: string,
  bbox: [number, number, number, number],
  release: string
): Promise<TimedResult> {
  const start = Date.now();
  const config = OVERTURE_DATASETS[datasetId];
  if (!config) return { features: [], durationMs: Date.now() - start };

  const [west, south, east, north] = bbox;

  let files: string[];
  try {
    const index = await getSpatialIndex(config.theme, config.type, release);
    files = index
      .filter((e) => {
        const [fW, fS, fE, fN] = e.bbox;
        return fW <= east && fE >= west && fS <= north && fN >= south;
      })
      .map((e) => e.file);
  } catch {
    files = await fetchAzureFileList(config.theme, config.type, release);
  }

  if (files.length === 0)
    return { features: [], durationMs: Date.now() - start };

  // Process up to 3 files (no strict subrequest limit on Vercel)
  const maxFiles = Math.min(files.length, 3);
  const allFeatures: GeoJSONFeature[] = [];
  for (let i = 0; i < maxFiles; i++) {
    if (allFeatures.length >= MAX_OVERTURE_FEATURES) break;
    const features = await extractFromParquet(
      files[i],
      bbox,
      datasetId,
      config
    );
    allFeatures.push(...features);
  }

  return { features: allFeatures, durationMs: Date.now() - start };
}

async function extractFromParquet(
  filePath: string,
  bbox: [number, number, number, number],
  datasetId: string,
  config: DatasetDef
): Promise<GeoJSONFeature[]> {
  const azureUrl = `${AZURE_STORAGE_BASE}/${filePath}`;
  const [west, south, east, north] = bbox;

  const headRes = await fetch(azureUrl, { method: 'HEAD' });
  if (!headRes.ok) throw new Error(`HEAD failed: ${headRes.status}`);
  const byteLength = parseInt(
    headRes.headers.get('Content-Length') || '0',
    10
  );

  const file = {
    byteLength,
    async slice(start: number, end: number): Promise<ArrayBuffer> {
      const res = await fetch(azureUrl, {
        headers: { Range: `bytes=${start}-${end - 1}` },
      });
      if (!res.ok && res.status !== 206)
        throw new Error(`Range failed: ${res.status}`);
      return res.arrayBuffer();
    },
  };

  const metadata = await parquetMetadataAsync(file);
  const allRanges = findMatchingRowRanges(metadata, bbox);
  if (allRanges.length === 0) return [];
  // Up to 3 row groups on Vercel (more CPU budget)
  const matchingRanges = allRanges.slice(0, 3);

  const features: GeoJSONFeature[] = [];
  const colIdx: Record<string, number> = {};
  config.columns.forEach((col, i) => {
    colIdx[col] = i;
  });
  const bboxIdx = colIdx['bbox'];
  const geomIdx = colIdx['geometry'];

  for (const range of matchingRanges) {
    if (features.length >= MAX_OVERTURE_FEATURES) break;
    await parquetRead({
      metadata,
      file,
      columns: config.columns,
      rowStart: range.start,
      rowEnd: Math.min(range.end, range.start + MAX_OVERTURE_FEATURES),
      compressors,
      onComplete: (rows: unknown[][]) => {
        for (const row of rows) {
          const arr = row as unknown[];

          if (bboxIdx !== undefined) {
            const rb = arr[bboxIdx] as Record<string, unknown> | undefined;
            if (rb && typeof rb === 'object') {
              const xmin = Number(rb.xmin ?? 0);
              const xmax = Number(rb.xmax ?? 0);
              const ymin = Number(rb.ymin ?? 0);
              const ymax = Number(rb.ymax ?? 0);
              if (
                xmin > east ||
                xmax < west ||
                ymin > north ||
                ymax < south
              )
                continue;
            }
          }

          const geomData =
            geomIdx !== undefined ? arr[geomIdx] : undefined;
          if (!geomData) continue;

          let geometry: Geometry | null = null;
          if (
            typeof geomData === 'object' &&
            'type' in (geomData as object) &&
            'coordinates' in (geomData as object)
          ) {
            geometry = geomData as Geometry;
          } else if (
            geomData instanceof Uint8Array ||
            geomData instanceof ArrayBuffer
          ) {
            const bytes =
              geomData instanceof Uint8Array
                ? geomData
                : new Uint8Array(geomData);
            geometry = wkbToGeoJSON(bytes);
          }
          if (!geometry) continue;

          const properties: Record<string, unknown> = {
            _source: 'overture',
            _dataset: datasetId,
          };

          for (const col of config.columns) {
            if (col === 'geometry' || col === 'bbox') continue;
            const val = arr[colIdx[col]];
            if (val == null) continue;

            if (col === 'id') {
              properties['id'] =
                typeof val === 'bigint' ? String(val) : val;
            } else if (col === 'names' && typeof val === 'object') {
              const names = val as Record<string, unknown>;
              if (names.primary)
                properties['name'] = String(names.primary);
            } else if (
              col === 'categories' &&
              typeof val === 'object'
            ) {
              const cats = val as Record<string, unknown>;
              if (cats.primary)
                properties['category'] = String(cats.primary);
            } else if (col === 'class') {
              properties['class'] =
                typeof val === 'bigint' ? Number(val) : val;
            } else if (col === 'subclass' || col === 'subtype') {
              properties['subclass'] =
                typeof val === 'bigint' ? Number(val) : val;
            } else if (col === 'height') {
              properties['height'] =
                typeof val === 'bigint' ? Number(val) : val;
            } else if (col === 'num_floors') {
              properties['num_floors'] =
                typeof val === 'bigint' ? Number(val) : val;
            } else if (col === 'confidence') {
              properties['confidence'] =
                typeof val === 'bigint' ? Number(val) : val;
            } else if (col === 'number' || col === 'street' || col === 'postcode' || col === 'city') {
              properties[col] = String(val);
            } else if (typeof val === 'bigint') {
              properties[col] = Number(val);
            } else if (typeof val !== 'object') {
              properties[col] = val;
            }
          }

          features.push({
            type: 'Feature',
            geometry: geometry as GeoJSONGeometry,
            properties,
          });
        }
      },
    });
  }

  return features;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OpenStreetMap Overpass extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function queryOverpassDataset(
  datasetId: string,
  bbox: [number, number, number, number]
): Promise<TimedResult> {
  const start = Date.now();
  const query = buildOverpassQuery(datasetId, bbox);
  if (!query) return { features: [], durationMs: Date.now() - start };

  const elements = await fetchOverpass(query);
  const features = elements
    .map((el) => elementToFeature(el, datasetId))
    .filter((f): f is GeoJSONFeature => f !== null);

  return { features, durationMs: Date.now() - start };
}

function buildOverpassQuery(
  datasetId: string,
  bbox: [number, number, number, number]
): string | null {
  const [west, south, east, north] = bbox;
  const bboxStr = `${south},${west},${north},${east}`;
  const parts: string[] = [];

  switch (datasetId) {
    case 'buildings':
      parts.push(
        `way["building"](${bboxStr})`,
        `relation["building"](${bboxStr})`
      );
      break;
    case 'places':
      parts.push(
        `node["amenity"](${bboxStr})`,
        `node["shop"](${bboxStr})`,
        `node["tourism"](${bboxStr})`,
        `node["leisure"](${bboxStr})`,
        `node["office"](${bboxStr})`,
        `node["healthcare"](${bboxStr})`
      );
      break;
    case 'transportation':
      parts.push(`way["highway"](${bboxStr})`);
      break;
    case 'land_use':
      parts.push(
        `way["landuse"](${bboxStr})`,
        `relation["landuse"](${bboxStr})`,
        `way["natural"~"wood|scrub|heath|grassland|wetland"](${bboxStr})`,
        `relation["natural"~"wood|scrub|heath|grassland|wetland"](${bboxStr})`
      );
      break;
    case 'water':
      parts.push(
        `way["natural"="water"](${bboxStr})`,
        `relation["natural"="water"](${bboxStr})`,
        `way["waterway"](${bboxStr})`,
        `relation["waterway"](${bboxStr})`
      );
      break;
    case 'infrastructure':
      parts.push(
        `way["railway"](${bboxStr})`,
        `way["power"="line"](${bboxStr})`,
        `way["power"="minor_line"](${bboxStr})`,
        `node["power"="tower"](${bboxStr})`,
        `node["power"="pole"](${bboxStr})`
      );
      break;
    case 'addresses':
      parts.push(
        `node["addr:housenumber"](${bboxStr})`
      );
      break;
    default:
      return null;
  }

  return `[out:json][timeout:90];(${parts.join(';')};);out geom;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    ref: number;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const endpoint =
      OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];

    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 || response.status === 504) {
        lastError = new Error(
          response.status === 429 ? 'Rate limited' : 'Timeout'
        );
        continue;
      }

      if (!response.ok) throw new Error(`Overpass ${response.status}`);

      const data = (await response.json()) as {
        elements?: OverpassElement[];
      };
      return data.elements || [];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 1) continue;
    }
  }

  throw lastError || new Error('Overpass query failed');
}

function elementToFeature(
  element: OverpassElement,
  datasetId: string
): GeoJSONFeature | null {
  const tags = element.tags || {};

  const properties: Record<string, unknown> = {
    _source: 'osm',
    _dataset: datasetId,
    id: `${element.type}/${element.id}`,
    name: tags.name || null,
  };

  if (datasetId === 'buildings') {
    properties['class'] =
      tags.building !== 'yes' ? tags.building : null;
    properties['height'] = tags.height
      ? parseFloat(tags.height) || null
      : null;
    properties['num_floors'] = tags['building:levels']
      ? parseInt(tags['building:levels']) || null
      : null;
  } else if (datasetId === 'places') {
    properties['category'] =
      tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || tags.healthcare || null;
  } else if (datasetId === 'transportation') {
    properties['class'] = tags.highway || null;
    properties['subclass'] = tags.surface || null;
  } else if (datasetId === 'land_use') {
    properties['class'] = tags.landuse || tags.natural || null;
  } else if (datasetId === 'water') {
    properties['class'] = tags.waterway || tags.natural || null;
    properties['subclass'] = tags.water || null;
  } else if (datasetId === 'infrastructure') {
    properties['class'] = tags.railway || tags.power || null;
    properties['subclass'] = tags.voltage || tags.usage || null;
  } else if (datasetId === 'addresses') {
    properties['number'] = tags['addr:housenumber'] || null;
    properties['street'] = tags['addr:street'] || null;
    properties['postcode'] = tags['addr:postcode'] || null;
    properties['city'] = tags['addr:city'] || null;
  }

  if (
    element.type === 'node' &&
    element.lat !== undefined &&
    element.lon !== undefined
  ) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [element.lon, element.lat],
      },
      properties,
    };
  }

  if (element.type === 'way' && element.geometry) {
    const coords = element.geometry.map((p) => [p.lon, p.lat]);
    const first = coords[0];
    const last = coords[coords.length - 1];
    const isClosed =
      first[0] === last[0] && first[1] === last[1] && coords.length >= 4;

    return {
      type: 'Feature',
      geometry: isClosed
        ? { type: 'Polygon', coordinates: [coords] }
        : { type: 'LineString', coordinates: coords },
      properties,
    };
  }

  if (element.type === 'relation' && element.members) {
    const outerRings: number[][][] = [];
    for (const member of element.members) {
      if (member.role === 'outer' && member.geometry) {
        outerRings.push(member.geometry.map((p) => [p.lon, p.lat]));
      }
    }
    if (outerRings.length === 0) return null;

    if (outerRings.length === 1) {
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: outerRings },
        properties,
      };
    }
    return {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: outerRings.map((r) => [r]),
      },
      properties,
    };
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Google Open Buildings V3 (S2 level-6 CSV on GCS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function queryGoogleBuildings(
  bbox: [number, number, number, number]
): Promise<TimedResult> {
  const start = Date.now();
  const [west, south, east, north] = bbox;
  const tokens = bboxToS2Tokens(bbox, 6);
  const features: GeoJSONFeature[] = [];

  for (const token of tokens) {
    if (features.length >= MAX_BUILDINGS_PER_SOURCE) break;
    const url = `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_6_gzip_no_header/${token}_buildings.csv.gz`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const ds = new DecompressionStream('gzip');
      const reader = res.body!.pipeThrough(ds).getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (features.length < MAX_BUILDINGS_PER_SOURCE) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;

          const c1 = line.indexOf(',');
          const c2 = line.indexOf(',', c1 + 1);
          const lat = parseFloat(line.substring(0, c1));
          const lng = parseFloat(line.substring(c1 + 1, c2));
          if (lat < south || lat > north || lng < west || lng > east)
            continue;

          const c3 = line.indexOf(',', c2 + 1);
          const c4 = line.indexOf(',', c3 + 1);
          const area = parseFloat(line.substring(c2 + 1, c3));
          const confidence = parseFloat(line.substring(c3 + 1, c4));

          const geomStart = line.indexOf('POLYGON', c4);
          if (geomStart === -1) continue;
          const lastParen = line.lastIndexOf(')');
          if (lastParen === -1) continue;
          const wkt = line.substring(geomStart, lastParen + 1);

          const geometry = parseWktPolygon(wkt);
          if (!geometry) continue;

          features.push({
            type: 'Feature',
            geometry,
            properties: {
              _source: 'google',
              _dataset: 'buildings',
              confidence: confidence || null,
              area_m2: area || null,
            },
          });

          if (features.length >= MAX_BUILDINGS_PER_SOURCE) break;
        }
      }

      reader.cancel().catch(() => {});
    } catch {
      continue;
    }
  }

  return { features, durationMs: Date.now() - start };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Microsoft Building Footprints (GeoJSONL via manifest + quadkey)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getMsManifest(): Promise<Map<string, string>> {
  if (msManifest) return msManifest;
  if (msManifestLoading) return msManifestLoading;

  msManifestLoading = (async () => {
    const res = await fetch(
      'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv'
    );
    if (!res.ok) throw new Error(`MS manifest: ${res.status}`);

    const map = new Map<string, string>();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line || line.startsWith('Location')) continue;
        const firstComma = line.indexOf(',');
        const secondComma = line.indexOf(',', firstComma + 1);
        const thirdComma = line.indexOf(',', secondComma + 1);
        if (firstComma < 0 || secondComma < 0) continue;
        const qk = line.substring(firstComma + 1, secondComma).trim();
        const url = line
          .substring(secondComma + 1, thirdComma > 0 ? thirdComma : undefined)
          .trim();
        if (qk && url) map.set(qk, url);
      }
    }

    msManifest = map;
    msManifestLoading = null;
    return map;
  })();

  return msManifestLoading;
}

async function queryMicrosoftBuildings(
  bbox: [number, number, number, number]
): Promise<TimedResult> {
  const start = Date.now();
  const [west, south, east, north] = bbox;
  const features: GeoJSONFeature[] = [];

  const manifest = await getMsManifest();
  const quadkeys = bboxToQuadkeys(bbox, 9);

  for (const qk of quadkeys) {
    if (features.length >= MAX_BUILDINGS_PER_SOURCE) break;
    const fileUrl = manifest.get(qk);
    if (!fileUrl) continue;

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) continue;

      const ds = new DecompressionStream('gzip');
      const reader = res.body!.pipeThrough(ds).getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (features.length < MAX_BUILDINGS_PER_SOURCE) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const feat = JSON.parse(line) as {
              type: string;
              geometry: GeoJSONGeometry;
              properties?: Record<string, unknown>;
            };
            if (feat.type !== 'Feature' || !feat.geometry) continue;

            const coords = feat.geometry.coordinates;
            if (!coordsInBbox(coords, west, south, east, north)) continue;

            features.push({
              type: 'Feature',
              geometry: feat.geometry,
              properties: {
                _source: 'microsoft',
                _dataset: 'buildings',
                ...feat.properties,
              },
            });

            if (features.length >= MAX_BUILDINGS_PER_SOURCE) break;
          } catch {
            continue;
          }
        }
      }

      reader.cancel().catch(() => {});
    } catch {
      continue;
    }
  }

  return { features, durationMs: Date.now() - start };
}

function coordsInBbox(
  coords: unknown,
  west: number,
  south: number,
  east: number,
  north: number
): boolean {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') {
    const lng = coords[0] as number,
      lat = coords[1] as number;
    return lng >= west && lng <= east && lat >= south && lat <= north;
  }
  for (const c of coords) {
    if (coordsInBbox(c, west, south, east, north)) return true;
  }
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Parquet row group predicate pushdown
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RowRange {
  start: number;
  end: number;
}
interface ColumnMeta {
  meta_data?: {
    path_in_schema?: string[];
    statistics?: {
      min?: unknown;
      max?: unknown;
      min_value?: unknown;
      max_value?: unknown;
    };
  };
}
interface RowGroupMeta {
  num_rows: number | bigint;
  columns: ColumnMeta[];
}

function findMatchingRowRanges(
  metadata: { row_groups: RowGroupMeta[] },
  bbox: [number, number, number, number]
): RowRange[] {
  const [west, south, east, north] = bbox;
  const ranges: RowRange[] = [];
  const colNames =
    metadata.row_groups[0]?.columns?.map(
      (c) => c.meta_data?.path_in_schema?.join('.') || ''
    ) || [];

  const xminIdx = colNames.indexOf('bbox.xmin');
  const xmaxIdx = colNames.indexOf('bbox.xmax');
  const yminIdx = colNames.indexOf('bbox.ymin');
  const ymaxIdx = colNames.indexOf('bbox.ymax');

  if (xminIdx < 0 || xmaxIdx < 0 || yminIdx < 0 || ymaxIdx < 0) {
    let offset = 0;
    for (const rg of metadata.row_groups) {
      const n = Number(rg.num_rows);
      ranges.push({ start: offset, end: offset + n });
      offset += n;
    }
    return ranges;
  }

  let rowOffset = 0;
  for (const rg of metadata.row_groups) {
    const numRows = Number(rg.num_rows);
    let skip = false;

    const xs = rg.columns[xminIdx]?.meta_data?.statistics;
    const xxs = rg.columns[xmaxIdx]?.meta_data?.statistics;
    const ys = rg.columns[yminIdx]?.meta_data?.statistics;
    const yxs = rg.columns[ymaxIdx]?.meta_data?.statistics;

    if (xs && xxs && ys && yxs) {
      const minXmin = toNumber(xs.min ?? xs.min_value);
      const maxXmax = toNumber(xxs.max ?? xxs.max_value);
      const minYmin = toNumber(ys.min ?? ys.min_value);
      const maxYmax = toNumber(yxs.max ?? yxs.max_value);

      if (minXmin !== null && minXmin > east) skip = true;
      if (maxXmax !== null && maxXmax < west) skip = true;
      if (minYmin !== null && minYmin > north) skip = true;
      if (maxYmax !== null && maxYmax < south) skip = true;
    }

    if (!skip) ranges.push({ start: rowOffset, end: rowOffset + numRows });
    rowOffset += numRows;
  }

  return ranges;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'bigint') return Number(val);
  if (val instanceof ArrayBuffer || val instanceof Uint8Array) {
    const buf =
      val instanceof Uint8Array ? val : new Uint8Array(val);
    if (buf.length === 8)
      return new DataView(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength
      ).getFloat64(0, true);
    if (buf.length === 4)
      return new DataView(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength
      ).getFloat32(0, true);
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WKB to GeoJSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Geometry {
  type: string;
  coordinates: unknown;
}
interface ReadResult {
  geometry: Geometry;
  offset: number;
}

function wkbToGeoJSON(buffer: ArrayBuffer | Uint8Array): Geometry | null {
  try {
    const data =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
    return readGeometry(view, 0).geometry;
  } catch {
    return null;
  }
}

function readGeometry(view: DataView, offset: number): ReadResult {
  const le = view.getUint8(offset) === 1;
  offset += 1;
  const rawType = view.getUint32(offset, le);
  offset += 4;
  const geomType = rawType & 0xff;
  if (rawType & 0x20000000) offset += 4;

  switch (geomType) {
    case 1:
      return readPoint(view, offset, le);
    case 2:
      return readLineString(view, offset, le);
    case 3:
      return readPolygon(view, offset, le);
    case 4:
      return readMulti(view, offset, le, 'MultiPoint');
    case 5:
      return readMulti(view, offset, le, 'MultiLineString');
    case 6:
      return readMulti(view, offset, le, 'MultiPolygon');
    default:
      throw new Error(`Unsupported WKB: ${geomType}`);
  }
}

function readPoint(v: DataView, o: number, le: boolean): ReadResult {
  return {
    geometry: {
      type: 'Point',
      coordinates: [v.getFloat64(o, le), v.getFloat64(o + 8, le)],
    },
    offset: o + 16,
  };
}

function readLineString(v: DataView, o: number, le: boolean): ReadResult {
  const n = v.getUint32(o, le);
  o += 4;
  const c: number[][] = [];
  for (let i = 0; i < n; i++) {
    c.push([v.getFloat64(o, le), v.getFloat64(o + 8, le)]);
    o += 16;
  }
  return { geometry: { type: 'LineString', coordinates: c }, offset: o };
}

function readPolygon(v: DataView, o: number, le: boolean): ReadResult {
  const nr = v.getUint32(o, le);
  o += 4;
  const rings: number[][][] = [];
  for (let r = 0; r < nr; r++) {
    const n = v.getUint32(o, le);
    o += 4;
    const ring: number[][] = [];
    for (let i = 0; i < n; i++) {
      ring.push([v.getFloat64(o, le), v.getFloat64(o + 8, le)]);
      o += 16;
    }
    rings.push(ring);
  }
  return { geometry: { type: 'Polygon', coordinates: rings }, offset: o };
}

function readMulti(
  v: DataView,
  o: number,
  le: boolean,
  type: string
): ReadResult {
  const n = v.getUint32(o, le);
  o += 4;
  const parts: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const r = readGeometry(v, o);
    parts.push(r.geometry.coordinates);
    o = r.offset;
  }
  return { geometry: { type, coordinates: parts }, offset: o };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Spatial index helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getSpatialIndex(
  theme: string,
  type: string,
  release: string
): Promise<SpatialEntry[]> {
  const cacheKey = `${release}/${theme}/${type}`;
  const cached = spatialIndexCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.entries;

  const [bboxes, files] = await Promise.all([
    fetchStacBboxes(theme, type, release),
    fetchAzureFileList(theme, type, release),
  ]);

  const entries: SpatialEntry[] = [];
  const count = Math.min(bboxes.length, files.length);
  for (let i = 0; i < count; i++)
    entries.push({ bbox: bboxes[i], file: files[i] });
  spatialIndexCache.set(cacheKey, { entries, ts: Date.now() });
  return entries;
}

async function fetchStacBboxes(
  theme: string,
  type: string,
  release: string
): Promise<[number, number, number, number][]> {
  const res = await fetch(
    `https://stac.overturemaps.org/${release}/${theme}/${type}/collection.json`,
    { headers: { 'User-Agent': 'draw2data/2.0' } }
  );
  if (!res.ok) throw new Error(`STAC ${res.status}`);
  const col = (await res.json()) as {
    extent?: { spatial?: { bbox?: number[][] } };
  };
  return (col.extent?.spatial?.bbox || []) as [
    number,
    number,
    number,
    number,
  ][];
}

async function fetchAzureFileList(
  theme: string,
  type: string,
  release: string
): Promise<string[]> {
  const prefix = `${release}/theme=${theme}/type=${type}/`;
  const res = await fetch(
    `${AZURE_STORAGE_BASE}?restype=container&comp=list&prefix=${encodeURIComponent(prefix)}&maxresults=5000`
  );
  if (!res.ok) throw new Error(`Azure list ${res.status}`);
  const xml = await res.text();
  const files: string[] = [];
  const re = /<Name>([^<]+)<\/Name>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].endsWith('.parquet')) files.push(m[1]);
  }
  return files;
}
