import type { Feature, FeatureCollection } from '../../types';
import { toGeoJSON } from './to-geojson';

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

type ShpType = 'Point' | 'PolyLine' | 'Polygon';

function geojsonTypeToShpType(geomType: string): ShpType | null {
  switch (geomType) {
    case 'Point':
    case 'MultiPoint':
      return 'Point';
    case 'LineString':
    case 'MultiLineString':
      return 'PolyLine';
    case 'Polygon':
    case 'MultiPolygon':
      return 'Polygon';
    default:
      return null;
  }
}

export async function toShapefileBlob(features: Feature[]): Promise<Blob> {
  const { shpWriteZip } = await import('shp-kit');

  // Group features by shapefile type
  const groups = new Map<ShpType, Feature[]>();
  for (const f of features) {
    if (!f.geometry) continue;
    const shpType = geojsonTypeToShpType(f.geometry.type);
    if (!shpType) continue;
    if (!groups.has(shpType)) groups.set(shpType, []);
    groups.get(shpType)!.push(f);
  }

  if (groups.size === 0) {
    throw new Error('No valid geometries to export as shapefile');
  }

  // Single geometry type: use shpWriteZip directly
  if (groups.size === 1) {
    const [shpType, groupFeatures] = [...groups.entries()][0];
    const fc: FeatureCollection = toGeoJSON(groupFeatures);
    return shpWriteZip('export', fc, shpType, {}, false, WGS84_PRJ);
  }

  // Multiple geometry types: generate separate shapefiles and combine into one ZIP
  const JSZip = (await import('jszip')).default;
  const { shpWrite } = await import('shp-kit');
  const zip = new JSZip();

  for (const [shpType, groupFeatures] of groups) {
    const fc: FeatureCollection = toGeoJSON(groupFeatures);
    const label = shpType === 'Point' ? 'points' : shpType === 'PolyLine' ? 'lines' : 'polygons';

    const result = await shpWrite(fc, shpType);
    zip.file(`${label}.shp`, result.shp);
    zip.file(`${label}.shx`, result.shx);
    zip.file(`${label}.dbf`, result.dbf);
    zip.file(`${label}.prj`, WGS84_PRJ);
  }

  return zip.generateAsync({ type: 'blob' });
}
