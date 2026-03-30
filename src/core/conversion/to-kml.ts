import type { Feature } from '../../types';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coordsToKml(coords: number[]): string {
  return `${coords[0]},${coords[1]},${coords[2] ?? 0}`;
}

function ringToKml(ring: number[][]): string {
  return ring.map(coordsToKml).join(' ');
}

function geometryToKml(geom: { type: string; coordinates: unknown }): string {
  switch (geom.type) {
    case 'Point': {
      const c = geom.coordinates as number[];
      return `<Point><coordinates>${coordsToKml(c)}</coordinates></Point>`;
    }
    case 'MultiPoint': {
      const pts = geom.coordinates as number[][];
      return `<MultiGeometry>${pts.map((c) => `<Point><coordinates>${coordsToKml(c)}</coordinates></Point>`).join('')}</MultiGeometry>`;
    }
    case 'LineString': {
      const c = geom.coordinates as number[][];
      return `<LineString><coordinates>${ringToKml(c)}</coordinates></LineString>`;
    }
    case 'MultiLineString': {
      const lines = geom.coordinates as number[][][];
      return `<MultiGeometry>${lines.map((l) => `<LineString><coordinates>${ringToKml(l)}</coordinates></LineString>`).join('')}</MultiGeometry>`;
    }
    case 'Polygon': {
      const rings = geom.coordinates as number[][][];
      const outer = `<outerBoundaryIs><LinearRing><coordinates>${ringToKml(rings[0])}</coordinates></LinearRing></outerBoundaryIs>`;
      const inner = rings.slice(1).map((r) =>
        `<innerBoundaryIs><LinearRing><coordinates>${ringToKml(r)}</coordinates></LinearRing></innerBoundaryIs>`
      ).join('');
      return `<Polygon>${outer}${inner}</Polygon>`;
    }
    case 'MultiPolygon': {
      const polys = geom.coordinates as number[][][][];
      return `<MultiGeometry>${polys.map((poly) => {
        const outer = `<outerBoundaryIs><LinearRing><coordinates>${ringToKml(poly[0])}</coordinates></LinearRing></outerBoundaryIs>`;
        const inner = poly.slice(1).map((r) =>
          `<innerBoundaryIs><LinearRing><coordinates>${ringToKml(r)}</coordinates></LinearRing></innerBoundaryIs>`
        ).join('');
        return `<Polygon>${outer}${inner}</Polygon>`;
      }).join('')}</MultiGeometry>`;
    }
    default:
      return '';
  }
}

export function toKMLBlob(features: Feature[]): Blob {
  const placemarks = features.map((f) => {
    const name = f.properties?.name || f.properties?.id || '';
    const desc = Object.entries(f.properties || {})
      .filter(([k]) => !k.startsWith('_') && k !== 'name' && k !== 'id')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const geomKml = f.geometry ? geometryToKml(f.geometry as { type: string; coordinates: unknown }) : '';

    return `<Placemark>
<name>${escapeXml(String(name))}</name>
<description>${escapeXml(desc)}</description>
${geomKml}
</Placemark>`;
  }).join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>draw2data export</name>
${placemarks}
</Document>
</kml>`;

  return new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
}
