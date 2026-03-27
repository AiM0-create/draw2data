import type { AOIGeometry, AOIState } from '../../types';
import { calculateAreaKm2, validateAOI } from '../../utils/geometry';

export function computeAOIState(geometry: AOIGeometry | null): AOIState {
  if (!geometry) {
    return { geometry: null, areaKm2: 0, isValid: false, error: null };
  }

  const areaKm2 = calculateAreaKm2(geometry);
  const { isValid, error } = validateAOI(geometry);

  return { geometry, areaKm2, isValid, error };
}

export function parseGeoJSONFile(text: string): AOIGeometry {
  const parsed = JSON.parse(text);

  // Handle FeatureCollection — use first polygon feature
  if (parsed.type === 'FeatureCollection') {
    const polyFeature = parsed.features?.find(
      (f: { geometry?: { type: string } }) =>
        f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    );
    if (!polyFeature) {
      throw new Error('No Polygon or MultiPolygon feature found in GeoJSON.');
    }
    return polyFeature.geometry;
  }

  // Handle Feature
  if (parsed.type === 'Feature') {
    if (parsed.geometry?.type !== 'Polygon' && parsed.geometry?.type !== 'MultiPolygon') {
      throw new Error('Feature must have Polygon or MultiPolygon geometry.');
    }
    return parsed.geometry;
  }

  // Handle bare geometry
  if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
    return parsed;
  }

  throw new Error('Invalid GeoJSON. Expected Polygon, MultiPolygon, Feature, or FeatureCollection.');
}
