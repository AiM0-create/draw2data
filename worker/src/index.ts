/**
 * draw2data CORS Proxy + Extraction Worker
 *
 * Serves as both a CORS proxy for Overture Maps data on Azure and a server-side
 * extraction engine. The /extract endpoint reads GeoParquet files directly from Azure,
 * applies spatial filtering via row group statistics (predicate pushdown), converts
 * WKB geometry to GeoJSON, and returns features — no rate limits, no CORS issues.
 *
 * Endpoints:
 *   GET  /                           → Health check
 *   GET  /release                    → Latest Overture release version
 *   GET  /files?...&bbox=W,S,E,N    → Spatially filtered file list
 *   POST /extract                    → Extract features as GeoJSON
 *   GET  /proxy/*                    → CORS proxy to Azure
 *   OPTIONS *                        → CORS preflight
 */

import { parquetMetadataAsync, parquetRead } from 'hyparquet';
import { decompress as decompressZstd } from 'fzstd';

// Only include zstd compressor — Overture uses zstd compression.
// Avoids hyparquet-compressors which bundles Snappy WASM (blocked in Workers).
const compressors = {
  ZSTD: (input: Uint8Array) => decompressZstd(input),
};

interface Env {
  AZURE_STORAGE_BASE: string;
}

const FALLBACK_RELEASE = '2026-03-18.0';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
};

// ─── Dataset config ─────────────────────────────────────────────────

interface DatasetDef {
  theme: string;
  type: string;
  columns: string[];
}

const DATASET_CONFIG: Record<string, DatasetDef> = {
  buildings: {
    theme: 'buildings',
    type: 'building',
    columns: ['id', 'names', 'class', 'subtype', 'height', 'num_floors', 'geometry', 'bbox'],
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
};

// ─── Spatial index cache ────────────────────────────────────────────

interface SpatialEntry {
  bbox: [number, number, number, number];
  file: string;
}
const spatialIndexCache = new Map<string, { entries: SpatialEntry[]; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// ─── Main handler ───────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === '/') {
        return json({ status: 'ok', service: 'draw2data-proxy' });
      }
      if (url.pathname === '/release') {
        return await handleRelease();
      }
      if (url.pathname === '/files') {
        return await handleFileList(url, env);
      }
      if (url.pathname === '/extract' && request.method === 'POST') {
        return await handleExtract(request, env);
      }
      if (url.pathname.startsWith('/proxy/')) {
        return await handleProxy(request, url, env);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return json({ error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ─── /release ───────────────────────────────────────────────────────

async function handleRelease(): Promise<Response> {
  try {
    const res = await fetch('https://stac.overturemaps.org/catalog.json');
    if (!res.ok) throw new Error(`STAC ${res.status}`);

    const catalog = (await res.json()) as { latest?: string; links?: { rel: string; href: string }[] };

    if (catalog.latest) return json({ latest: catalog.latest });

    const versions = (catalog.links || [])
      .filter((l) => l.rel === 'child')
      .map((l) => l.href.match(/(\d{4}-\d{2}-\d{2}\.\d+)/)?.[1])
      .filter(Boolean) as string[];
    versions.sort().reverse();

    return json({ latest: versions[0] || FALLBACK_RELEASE });
  } catch {
    return json({ latest: FALLBACK_RELEASE, fallback: true });
  }
}

// ─── /files ─────────────────────────────────────────────────────────

async function handleFileList(url: URL, env: Env): Promise<Response> {
  const theme = url.searchParams.get('theme');
  const type = url.searchParams.get('type');
  const release = url.searchParams.get('release') || '';
  const bboxParam = url.searchParams.get('bbox') || '';

  if (!theme || !type || !release) {
    return json({ error: 'Missing theme, type, or release parameter' }, 400);
  }

  let files: string[];
  let spatialFiltered = false;

  try {
    const index = await getSpatialIndex(theme, type, release, env);

    if (!bboxParam) {
      return json({ files: index.map((e) => e.file), total: index.length });
    }

    const [qWest, qSouth, qEast, qNorth] = bboxParam.split(',').map(Number);
    if ([qWest, qSouth, qEast, qNorth].some(isNaN)) {
      return json({ error: 'Invalid bbox format. Expected: west,south,east,north' }, 400);
    }

    const matching = index.filter((entry) => {
      const [fWest, fSouth, fEast, fNorth] = entry.bbox;
      return fWest <= qEast && fEast >= qWest && fSouth <= qNorth && fNorth >= qSouth;
    });

    files = matching.map((e) => e.file);
    spatialFiltered = true;
  } catch {
    files = await fetchAzureFileList(theme, type, release, env);
    spatialFiltered = false;
  }

  return json({ files, matched: files.length, spatialFiltered });
}

// ─── /extract ───────────────────────────────────────────────────────

interface ExtractRequest {
  datasets: string[];
  bbox: [number, number, number, number];
}

async function handleExtract(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ExtractRequest;
  const { datasets, bbox } = body;

  if (!datasets?.length || !bbox || bbox.length !== 4) {
    return json({ error: 'Missing datasets or bbox' }, 400);
  }

  const [west, south, east, north] = bbox;

  // Get release
  let release = FALLBACK_RELEASE;
  try {
    const relRes = await fetch('https://stac.overturemaps.org/catalog.json');
    if (relRes.ok) {
      const cat = (await relRes.json()) as { latest?: string };
      if (cat.latest) release = cat.latest;
    }
  } catch { /* use fallback */ }

  const allFeatures: GeoJSONFeature[] = [];

  for (const datasetId of datasets) {
    const config = DATASET_CONFIG[datasetId];
    if (!config) continue;

    // Find matching files via spatial index
    let files: string[];
    try {
      const index = await getSpatialIndex(config.theme, config.type, release, env);
      files = index
        .filter((e) => {
          const [fW, fS, fE, fN] = e.bbox;
          return fW <= east && fE >= west && fS <= north && fN >= south;
        })
        .map((e) => e.file);
    } catch {
      files = await fetchAzureFileList(config.theme, config.type, release, env);
    }

    if (files.length === 0) continue;

    // Extract features from each matching file
    for (const filePath of files) {
      const features = await extractFromFile(filePath, bbox, datasetId, config, env);
      allFeatures.push(...features);
    }
  }

  return json({
    type: 'FeatureCollection',
    features: allFeatures,
    metadata: {
      featureCount: allFeatures.length,
      datasetsQueried: datasets,
      source: 'overture',
      release,
    },
  });
}

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

/**
 * Read features from a single Overture Parquet file with row group predicate pushdown.
 */
async function extractFromFile(
  filePath: string,
  bbox: [number, number, number, number],
  datasetId: string,
  config: DatasetDef,
  env: Env
): Promise<GeoJSONFeature[]> {
  const azureUrl = `${env.AZURE_STORAGE_BASE}/${filePath}`;
  const [west, south, east, north] = bbox;

  // Create async file handle for hyparquet
  const headRes = await fetch(azureUrl, { method: 'HEAD' });
  if (!headRes.ok) throw new Error(`HEAD failed: ${headRes.status}`);
  const byteLength = parseInt(headRes.headers.get('Content-Length') || '0', 10);

  const file = {
    byteLength,
    async slice(start: number, end: number): Promise<ArrayBuffer> {
      const res = await fetch(azureUrl, {
        headers: { Range: `bytes=${start}-${end - 1}` },
      });
      if (!res.ok && res.status !== 206) throw new Error(`Range failed: ${res.status}`);
      return res.arrayBuffer();
    },
  };

  // Read parquet metadata (just the footer)
  const metadata = await parquetMetadataAsync(file);

  // Find matching row groups using column statistics
  const matchingRanges = findMatchingRowRanges(metadata, bbox);
  if (matchingRanges.length === 0) return [];

  const features: GeoJSONFeature[] = [];

  // Build column index map: column name → position in config.columns
  const colIdx: Record<string, number> = {};
  config.columns.forEach((col, i) => { colIdx[col] = i; });

  const bboxIdx = colIdx['bbox'];
  const geomIdx = colIdx['geometry'];

  for (const range of matchingRanges) {
    await parquetRead({
      metadata,
      file,
      columns: config.columns,
      rowStart: range.start,
      rowEnd: range.end,
      compressors,
      onComplete: (rows: unknown[][]) => {
        for (const row of rows) {
          const arr = row as unknown[];

          // Filter by exact bbox overlap
          if (bboxIdx !== undefined) {
            const rowBbox = arr[bboxIdx] as Record<string, unknown> | undefined;
            if (rowBbox && typeof rowBbox === 'object') {
              const xmin = Number(rowBbox.xmin ?? 0);
              const xmax = Number(rowBbox.xmax ?? 0);
              const ymin = Number(rowBbox.ymin ?? 0);
              const ymax = Number(rowBbox.ymax ?? 0);
              if (xmin > east || xmax < west || ymin > north || ymax < south) continue;
            }
          }

          // Get geometry — hyparquet may return it already parsed as GeoJSON or as WKB bytes
          const geomData = geomIdx !== undefined ? arr[geomIdx] : undefined;
          if (!geomData) continue;

          let geometry: Geometry | null = null;
          if (typeof geomData === 'object' && 'type' in (geomData as object) && 'coordinates' in (geomData as object)) {
            // Already parsed as GeoJSON by hyparquet
            geometry = geomData as Geometry;
          } else if (geomData instanceof Uint8Array || geomData instanceof ArrayBuffer) {
            // WKB bytes — convert
            const bytes = geomData instanceof Uint8Array ? geomData : new Uint8Array(geomData);
            geometry = wkbToGeoJSON(bytes);
          }
          if (!geometry) continue;

          // Build properties
          const properties: Record<string, unknown> = {
            source: 'overture',
            dataset: datasetId,
          };

          for (const col of config.columns) {
            if (col === 'geometry' || col === 'bbox') continue;
            const val = arr[colIdx[col]];
            if (val == null) continue;

            if (col === 'names' && typeof val === 'object') {
              const names = val as Record<string, unknown>;
              if (names.primary) properties['name'] = String(names.primary);
            } else if (col === 'categories' && typeof val === 'object') {
              const cats = val as Record<string, unknown>;
              if (cats.primary) properties['category'] = String(cats.primary);
            } else if (typeof val === 'bigint') {
              properties[col] = Number(val);
            } else if (typeof val === 'object') {
              try {
                properties[col] = JSON.parse(JSON.stringify(val, (_k, v) =>
                  typeof v === 'bigint' ? Number(v) : v
                ));
              } catch { /* skip */ }
            } else {
              properties[col] = val;
            }
          }

          features.push({ type: 'Feature', geometry: geometry as GeoJSONGeometry, properties });
        }
      },
    });
  }

  return features;
}

// ─── Row group predicate pushdown ───────────────────────────────────

interface RowRange { start: number; end: number }

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

  const colNames = metadata.row_groups[0]?.columns?.map(
    (c: ColumnMeta) => c.meta_data?.path_in_schema?.join('.') || ''
  ) || [];

  const xminIdx = colNames.indexOf('bbox.xmin');
  const xmaxIdx = colNames.indexOf('bbox.xmax');
  const yminIdx = colNames.indexOf('bbox.ymin');
  const ymaxIdx = colNames.indexOf('bbox.ymax');

  if (xminIdx < 0 || xmaxIdx < 0 || yminIdx < 0 || ymaxIdx < 0) {
    // No bbox columns — include all row groups
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
    let dominated = false;

    const xminStats = rg.columns[xminIdx]?.meta_data?.statistics;
    const xmaxStats = rg.columns[xmaxIdx]?.meta_data?.statistics;
    const yminStats = rg.columns[yminIdx]?.meta_data?.statistics;
    const ymaxStats = rg.columns[ymaxIdx]?.meta_data?.statistics;

    if (xminStats && xmaxStats && yminStats && ymaxStats) {
      const minXmin = toNumber(xminStats.min ?? xminStats.min_value);
      const maxXmax = toNumber(xmaxStats.max ?? xmaxStats.max_value);
      const minYmin = toNumber(yminStats.min ?? yminStats.min_value);
      const maxYmax = toNumber(ymaxStats.max ?? ymaxStats.max_value);

      if (minXmin !== null && minXmin > east) dominated = true;
      if (maxXmax !== null && maxXmax < west) dominated = true;
      if (minYmin !== null && minYmin > north) dominated = true;
      if (maxYmax !== null && maxYmax < south) dominated = true;
    }

    if (!dominated) {
      ranges.push({ start: rowOffset, end: rowOffset + numRows });
    }

    rowOffset += numRows;
  }

  return ranges;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'bigint') return Number(val);
  if (val instanceof ArrayBuffer || val instanceof Uint8Array) {
    const buf = val instanceof Uint8Array ? val : new Uint8Array(val);
    if (buf.length === 8) {
      return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getFloat64(0, true);
    }
    if (buf.length === 4) {
      return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getFloat32(0, true);
    }
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ─── WKB to GeoJSON ─────────────────────────────────────────────────

const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_POLYGON = 3;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;
const WKB_MULTIPOLYGON = 6;

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
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const result = readGeometry(view, 0);
    return result.geometry;
  } catch {
    return null;
  }
}

function readGeometry(view: DataView, offset: number): ReadResult {
  const byteOrder = view.getUint8(offset);
  const le = byteOrder === 1;
  offset += 1;

  const rawType = view.getUint32(offset, le);
  offset += 4;

  const geomType = rawType & 0xff;

  if (rawType & 0x20000000) {
    offset += 4; // skip SRID
  }

  switch (geomType) {
    case WKB_POINT: return readPoint(view, offset, le);
    case WKB_LINESTRING: return readLineString(view, offset, le);
    case WKB_POLYGON: return readPolygon(view, offset, le);
    case WKB_MULTIPOINT: return readMulti(view, offset, le, 'MultiPoint');
    case WKB_MULTILINESTRING: return readMulti(view, offset, le, 'MultiLineString');
    case WKB_MULTIPOLYGON: return readMulti(view, offset, le, 'MultiPolygon');
    default: throw new Error(`Unsupported WKB type: ${geomType}`);
  }
}

function readPoint(view: DataView, offset: number, le: boolean): ReadResult {
  const x = view.getFloat64(offset, le);
  const y = view.getFloat64(offset + 8, le);
  return { geometry: { type: 'Point', coordinates: [x, y] }, offset: offset + 16 };
}

function readLineString(view: DataView, offset: number, le: boolean): ReadResult {
  const n = view.getUint32(offset, le);
  offset += 4;
  const coords: number[][] = [];
  for (let i = 0; i < n; i++) {
    coords.push([view.getFloat64(offset, le), view.getFloat64(offset + 8, le)]);
    offset += 16;
  }
  return { geometry: { type: 'LineString', coordinates: coords }, offset };
}

function readPolygon(view: DataView, offset: number, le: boolean): ReadResult {
  const numRings = view.getUint32(offset, le);
  offset += 4;
  const rings: number[][][] = [];
  for (let r = 0; r < numRings; r++) {
    const n = view.getUint32(offset, le);
    offset += 4;
    const ring: number[][] = [];
    for (let i = 0; i < n; i++) {
      ring.push([view.getFloat64(offset, le), view.getFloat64(offset + 8, le)]);
      offset += 16;
    }
    rings.push(ring);
  }
  return { geometry: { type: 'Polygon', coordinates: rings }, offset };
}

function readMulti(view: DataView, offset: number, le: boolean, type: string): ReadResult {
  const n = view.getUint32(offset, le);
  offset += 4;
  const parts: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const result = readGeometry(view, offset);
    parts.push(result.geometry.coordinates);
    offset = result.offset;
  }
  return { geometry: { type, coordinates: parts }, offset };
}

// ─── Spatial index helpers ──────────────────────────────────────────

async function getSpatialIndex(
  theme: string,
  type: string,
  release: string,
  env: Env
): Promise<SpatialEntry[]> {
  const cacheKey = `${release}/${theme}/${type}`;
  const cached = spatialIndexCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.entries;
  }

  const [bboxes, files] = await Promise.all([
    fetchStacBboxes(theme, type, release),
    fetchAzureFileList(theme, type, release, env),
  ]);

  const entries: SpatialEntry[] = [];
  const count = Math.min(bboxes.length, files.length);
  for (let i = 0; i < count; i++) {
    entries.push({ bbox: bboxes[i], file: files[i] });
  }

  spatialIndexCache.set(cacheKey, { entries, ts: Date.now() });
  return entries;
}

async function fetchStacBboxes(
  theme: string,
  type: string,
  release: string
): Promise<[number, number, number, number][]> {
  const stacUrl = `https://stac.overturemaps.org/${release}/${theme}/${type}/collection.json`;
  const res = await fetch(stacUrl, {
    headers: { 'User-Agent': 'draw2data-proxy/1.0' },
  });
  if (!res.ok) throw new Error(`STAC collection fetch failed: ${res.status}`);

  const collection = (await res.json()) as {
    extent?: { spatial?: { bbox?: number[][] } };
  };

  return (collection.extent?.spatial?.bbox || []) as [number, number, number, number][];
}

async function fetchAzureFileList(
  theme: string,
  type: string,
  release: string,
  env: Env
): Promise<string[]> {
  const prefix = `${release}/theme=${theme}/type=${type}/`;
  const listUrl =
    `${env.AZURE_STORAGE_BASE}?restype=container&comp=list` +
    `&prefix=${encodeURIComponent(prefix)}` +
    `&maxresults=5000`;

  const res = await fetch(listUrl);
  if (!res.ok) throw new Error(`Azure list failed: ${res.status}`);

  const xml = await res.text();
  const files: string[] = [];
  const nameRegex = /<Name>([^<]+)<\/Name>/g;
  let match;
  while ((match = nameRegex.exec(xml)) !== null) {
    if (match[1].endsWith('.parquet')) files.push(match[1]);
  }

  return files;
}

// ─── /proxy ─────────────────────────────────────────────────────────

async function handleProxy(request: Request, url: URL, env: Env): Promise<Response> {
  const blobPath = url.pathname.slice('/proxy/'.length);
  const azureUrl = `${env.AZURE_STORAGE_BASE}/${blobPath}`;

  const headers = new Headers();
  for (const h of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
    const val = request.headers.get(h);
    if (val) headers.set(h, val);
  }

  const res = await fetch(azureUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
  });

  const responseHeaders = new Headers(CORS_HEADERS);
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
    const val = res.headers.get(h);
    if (val) responseHeaders.set(h, val);
  }

  return new Response(res.body, { status: res.status, headers: responseHeaders });
}

// ─── helpers ────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, (_k, v) => typeof v === 'bigint' ? Number(v) : v), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
