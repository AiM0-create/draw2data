import type { Feature, FeatureCollection } from '../../types';

export function toGeoJSON(features: Feature[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}

export function toGeoJSONBlob(features: Feature[]): Blob {
  const fc = toGeoJSON(features);
  const json = JSON.stringify(fc, null, 2);
  return new Blob([json], { type: 'application/geo+json' });
}
