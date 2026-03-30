import turfArea from '@turf/area';
import { feature as turfFeature } from '@turf/helpers';
import type { AOIGeometry } from '../types';

const MAX_AOI_AREA_KM2 = 200;

export function calculateAreaKm2(geometry: AOIGeometry): number {
  const feat = turfFeature(geometry);
  const areaM2 = turfArea(feat);
  return areaM2 / 1_000_000;
}

export function validateAOI(geometry: AOIGeometry): { isValid: boolean; error: string | null } {
  const areaKm2 = calculateAreaKm2(geometry);

  if (areaKm2 > MAX_AOI_AREA_KM2) {
    return {
      isValid: false,
      error: `Area too large (${areaKm2.toFixed(1)} km²). Maximum is ${MAX_AOI_AREA_KM2} km².`,
    };
  }

  if (areaKm2 < 0.001) {
    return {
      isValid: false,
      error: 'Area too small. Please draw a larger region.',
    };
  }

  return { isValid: true, error: null };
}

export function getBbox(geometry: AOIGeometry): [number, number, number, number] {
  const coords = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}
