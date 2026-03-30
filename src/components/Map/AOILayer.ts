import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AOIGeometry } from '../../types';

const SOURCE_ID = 'aoi-source';
const FILL_LAYER = 'aoi-fill';
const LINE_LAYER = 'aoi-outline';

function makeData(geometry: AOIGeometry | null) {
  return geometry
    ? { type: 'Feature' as const, properties: {}, geometry }
    : { type: 'FeatureCollection' as const, features: [] as never[] };
}

function applyToMap(map: MaplibreMap, geometry: AOIGeometry | null) {
  try {
    // Ensure source exists
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: makeData(geometry) });
    }
    // Ensure layers exist
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.15 },
      });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#6366f1', 'line-width': 2.5, 'line-dasharray': [3, 2] },
      });
    }
    // Update data
    const src = map.getSource(SOURCE_ID);
    if (src && 'setData' in src) {
      (src as unknown as { setData(d: unknown): void }).setData(makeData(geometry));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders the current AOI geometry as a native MapLibre layer.
 * Uses idle event as a reliable fallback when style isn't ready.
 */
export function useAOILayer(map: MaplibreMap | null, geometry: AOIGeometry | null) {
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  // Apply geometry whenever map or geometry changes
  useEffect(() => {
    if (!map) return;

    // Try immediately, then retry on idle if it fails
    if (!applyToMap(map, geometry)) {
      const onIdle = () => applyToMap(map, geometryRef.current);
      map.once('idle', onIdle);
      return () => { map.off('idle', onIdle); };
    }
  }, [map, geometry]);

  // Re-apply after basemap / style changes wipe layers
  useEffect(() => {
    if (!map) return;

    const onStyleData = () => {
      // After a style swap, source/layers are gone — re-add
      if (!map.getSource(SOURCE_ID)) {
        // Use idle to ensure the new style is fully loaded
        map.once('idle', () => applyToMap(map, geometryRef.current));
      }
    };

    map.on('styledata', onStyleData);
    return () => { map.off('styledata', onStyleData); };
  }, [map]);
}
