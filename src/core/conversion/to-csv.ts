import type { Feature } from '../../types';

function geometryToWkt(geometry: Feature['geometry']): string {
  if (!geometry) return '';

  switch (geometry.type) {
    case 'Point':
      return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;

    case 'LineString':
      return `LINESTRING(${geometry.coordinates.map((c) => `${c[0]} ${c[1]}`).join(', ')})`;

    case 'Polygon':
      return `POLYGON(${geometry.coordinates.map((ring) => `(${ring.map((c) => `${c[0]} ${c[1]}`).join(', ')})`).join(', ')})`;

    case 'MultiPolygon':
      return `MULTIPOLYGON(${geometry.coordinates.map((poly) => `(${poly.map((ring) => `(${ring.map((c) => `${c[0]} ${c[1]}`).join(', ')})`).join(', ')})`).join(', ')})`;

    default:
      return JSON.stringify(geometry);
  }
}

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV(features: Feature[]): string {
  if (features.length === 0) return '';

  // Collect all unique property keys
  const propKeys = new Set<string>();
  for (const f of features) {
    if (f.properties) {
      Object.keys(f.properties).forEach((k) => propKeys.add(k));
    }
  }

  const columns = ['geometry_wkt', 'latitude', 'longitude', ...Array.from(propKeys)];
  const header = columns.map(escapeCSVField).join(',');

  const rows = features.map((f) => {
    const wkt = geometryToWkt(f.geometry);
    let lat = '';
    let lng = '';

    if (f.geometry?.type === 'Point') {
      lng = String(f.geometry.coordinates[0]);
      lat = String(f.geometry.coordinates[1]);
    }

    const values = [wkt, lat, lng, ...Array.from(propKeys).map((k) => escapeCSVField(f.properties?.[k]))];
    return values.join(',');
  });

  return [header, ...rows].join('\n');
}

export function toCSVBlob(features: Feature[]): Blob {
  const csv = toCSV(features);
  return new Blob([csv], { type: 'text/csv' });
}
