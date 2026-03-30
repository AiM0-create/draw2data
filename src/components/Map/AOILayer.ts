import { useEffect } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AOIGeometry } from '../../types';

const SOURCE_ID = 'aoi-source';
const FILL_LAYER = 'aoi-fill';
const LINE_LAYER = 'aoi-outline';

/**
 * Renders the current AOI geometry as a native MapLibre layer.
 * Works for both drawn and search-selected AOIs.
 */
export function useAOILayer(map: MaplibreMap | null, geometry: AOIGeometry | null) {
  useEffect(() => {
    if (!map) return;

    // Wait for style to be loaded
    const setup = () => {
      // Add source if not present
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      // Add fill layer
      if (!map.getLayer(FILL_LAYER)) {
        map.addLayer({
          id: FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': '#6366f1',
            'fill-opacity': 0.12,
          },
        });
      }

      // Add outline layer
      if (!map.getLayer(LINE_LAYER)) {
        map.addLayer({
          id: LINE_LAYER,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#6366f1',
            'line-width': 2.5,
            'line-dasharray': [3, 2],
          },
        });
      }

      // Update data
      const source = map.getSource(SOURCE_ID);
      if (source && 'setData' in source) {
        if (geometry) {
          (source as { setData: (d: unknown) => void }).setData({
            type: 'Feature',
            properties: {},
            geometry,
          });
        } else {
          (source as { setData: (d: unknown) => void }).setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      }
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once('style.load', setup);
    }

    return () => {
      // Cleanup on unmount only — don't remove on every geometry change
    };
  }, [map, geometry]);

  // Re-add layers after style changes (basemap toggle)
  useEffect(() => {
    if (!map) return;

    const onStyleData = () => {
      // After a full style change, sources/layers are gone — re-add them
      if (!map.getSource(SOURCE_ID) && geometry) {
        // Small delay to ensure style is fully loaded
        setTimeout(() => {
          if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry,
              },
            });
          }
          if (!map.getLayer(FILL_LAYER)) {
            map.addLayer({
              id: FILL_LAYER,
              type: 'fill',
              source: SOURCE_ID,
              paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.12 },
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
        }, 50);
      }
    };

    map.on('styledata', onStyleData);
    return () => {
      map.off('styledata', onStyleData);
    };
  }, [map, geometry]);
}
