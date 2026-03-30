import { useEffect, useRef } from 'react';
import { Popup, LngLatBounds } from 'maplibre-gl';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Feature } from 'geojson';

const SOURCE_ID = 'extraction-results';

const DATASET_COLORS: Record<string, { fill: string; stroke: string; point: string }> = {
  buildings: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#ef4444', point: '#ef4444' },
  places: { fill: 'rgba(34, 197, 94, 0.4)', stroke: '#16a34a', point: '#16a34a' },
  transportation: { fill: 'rgba(59, 130, 246, 0.3)', stroke: '#3b82f6', point: '#3b82f6' },
  land_use: { fill: 'rgba(234, 179, 8, 0.25)', stroke: '#ca8a04', point: '#ca8a04' },
  water: { fill: 'rgba(14, 165, 233, 0.3)', stroke: '#0284c7', point: '#0284c7' },
  infrastructure: { fill: 'rgba(168, 85, 247, 0.3)', stroke: '#9333ea', point: '#9333ea' },
  addresses: { fill: 'rgba(249, 115, 22, 0.3)', stroke: '#ea580c', point: '#ea580c' },
};

const DEFAULT_COLOR = { fill: 'rgba(107, 114, 128, 0.25)', stroke: '#6b7280', point: '#6b7280' };

const LAYER_IDS = [
  `${SOURCE_ID}-fill`,
  `${SOURCE_ID}-line`,
  `${SOURCE_ID}-point`,
  `${SOURCE_ID}-transport-line`,
];

function cleanup(map: MaplibreMap) {
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

/** Build popup HTML for a clicked feature */
function buildPopupHTML(props: Record<string, unknown>): string {
  const rows: string[] = [];
  const priority = ['name', '_dataset', '_source', 'class', 'category', 'height'];
  const skip = new Set(['id', '_dataset', '_source']);

  // Header: name or id
  const name = props.name || props.id || 'Feature';
  const dataset = props._dataset || '';
  const source = props._source || '';
  rows.push(`<div style="font-weight:600;font-size:13px;margin-bottom:4px">${name}</div>`);
  rows.push(`<div style="font-size:11px;color:#6b7280;margin-bottom:6px">${dataset}${source ? ` · ${source}` : ''}</div>`);

  // Key properties
  for (const key of priority) {
    if (skip.has(key) || props[key] == null || props[key] === '') continue;
    rows.push(`<div style="font-size:11px"><span style="color:#6b7280">${key}:</span> ${props[key]}</div>`);
  }

  // Remaining non-internal properties (limit to 5 more)
  let extra = 0;
  for (const [key, val] of Object.entries(props)) {
    if (extra >= 5) break;
    if (priority.includes(key) || key.startsWith('_') || val == null || val === '') continue;
    rows.push(`<div style="font-size:11px"><span style="color:#6b7280">${key}:</span> ${val}</div>`);
    extra++;
  }

  return rows.join('');
}

/** Compute LngLatBounds from a set of GeoJSON features */
export function computeBounds(features: Feature[]): LngLatBounds | null {
  if (!features.length) return null;
  const bounds = new LngLatBounds();
  for (const f of features) {
    visitCoords(f.geometry, (lng, lat) => bounds.extend([lng, lat]));
  }
  return bounds.isEmpty() ? null : bounds;
}

function visitCoords(geom: unknown, fn: (lng: number, lat: number) => void) {
  const g = geom as { type: string; coordinates: unknown; geometries?: unknown[] };
  if (!g || !g.type) return;
  if (g.type === 'Point') {
    const c = g.coordinates as [number, number];
    fn(c[0], c[1]);
  } else if (g.type === 'MultiPoint' || g.type === 'LineString') {
    for (const c of g.coordinates as [number, number][]) fn(c[0], c[1]);
  } else if (g.type === 'MultiLineString' || g.type === 'Polygon') {
    for (const ring of g.coordinates as [number, number][][]) for (const c of ring) fn(c[0], c[1]);
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates as [number, number][][][]) for (const ring of poly) for (const c of ring) fn(c[0], c[1]);
  } else if (g.type === 'GeometryCollection' && g.geometries) {
    for (const sub of g.geometries) visitCoords(sub, fn);
  }
}

export function useResultsLayer(map: MaplibreMap | null, features: Feature[] | null) {
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    cleanup(map);
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    if (!features || features.length === 0) return;

    // Split features by geometry type for proper layering
    const polygons: Feature[] = [];
    const lines: Feature[] = [];
    const points: Feature[] = [];
    const transportLines: Feature[] = [];

    for (const f of features) {
      const geomType = f.geometry?.type;
      const dataset = (f.properties?._dataset as string) || '';

      if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
        polygons.push(f);
      } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
        if (dataset === 'transportation') {
          transportLines.push(f);
        } else {
          lines.push(f);
        }
      } else if (geomType === 'Point' || geomType === 'MultiPoint') {
        points.push(f);
      }
    }

    // Add all features as one source
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    // Build color expressions based on _dataset property
    const datasets = Object.keys(DATASET_COLORS);
    const fillColorExpr: unknown[] = ['match', ['get', '_dataset']];
    const strokeColorExpr: unknown[] = ['match', ['get', '_dataset']];
    const pointColorExpr: unknown[] = ['match', ['get', '_dataset']];

    for (const ds of datasets) {
      fillColorExpr.push(ds, DATASET_COLORS[ds].fill);
      strokeColorExpr.push(ds, DATASET_COLORS[ds].stroke);
      pointColorExpr.push(ds, DATASET_COLORS[ds].point);
    }
    fillColorExpr.push(DEFAULT_COLOR.fill);
    strokeColorExpr.push(DEFAULT_COLOR.stroke);
    pointColorExpr.push(DEFAULT_COLOR.point);

    // Polygon fill layer
    if (polygons.length > 0) {
      map.addLayer({
        id: `${SOURCE_ID}-fill`,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['any',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        paint: {
          'fill-color': fillColorExpr as never,
          'fill-opacity': 0.6,
        },
      });
    }

    // Polygon/line outline layer
    if (polygons.length > 0 || lines.length > 0) {
      map.addLayer({
        id: `${SOURCE_ID}-line`,
        type: 'line',
        source: SOURCE_ID,
        filter: ['any',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['geometry-type'], 'MultiLineString'],
        ],
        paint: {
          'line-color': strokeColorExpr as never,
          'line-width': ['case',
            ['any',
              ['==', ['geometry-type'], 'LineString'],
              ['==', ['geometry-type'], 'MultiLineString'],
            ], 2,
            1,
          ] as never,
          'line-opacity': 0.8,
        },
      });
    }

    // Transportation lines (thicker, on top)
    if (transportLines.length > 0) {
      map.addLayer({
        id: `${SOURCE_ID}-transport-line`,
        type: 'line',
        source: SOURCE_ID,
        filter: ['all',
          ['==', ['get', '_dataset'], 'transportation'],
          ['any',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['geometry-type'], 'MultiLineString'],
          ],
        ],
        paint: {
          'line-color': DATASET_COLORS.transportation.stroke,
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });
    }

    // Point layer (circles)
    if (points.length > 0) {
      map.addLayer({
        id: `${SOURCE_ID}-point`,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['any',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['geometry-type'], 'MultiPoint'],
        ],
        paint: {
          'circle-radius': 4,
          'circle-color': pointColorExpr as never,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8,
        },
      });
    }

    // --- Click-to-inspect popup ---
    const activeLayers = LAYER_IDS.filter(id => map.getLayer(id));

    const onClick = (e: MapMouseEvent) => {
      if (!activeLayers.length) return;
      const queried = map.queryRenderedFeatures(e.point, { layers: activeLayers });
      if (!queried.length) return;

      const feat = queried[0];
      const props = feat.properties || {};
      if (popupRef.current) popupRef.current.remove();

      popupRef.current = new Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHTML(props))
        .addTo(map);
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

    for (const layerId of activeLayers) {
      map.on('click', layerId, onClick);
      map.on('mouseenter', layerId, onMouseEnter);
      map.on('mouseleave', layerId, onMouseLeave);
    }

    // --- Fit map to results ---
    const bounds = computeBounds(features);
    if (bounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
    }

    return () => {
      for (const layerId of activeLayers) {
        if (map.getLayer(layerId)) {
          map.off('click', layerId, onClick);
          map.off('mouseenter', layerId, onMouseEnter);
          map.off('mouseleave', layerId, onMouseLeave);
        }
      }
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      if (map.isStyleLoaded()) cleanup(map);
    };
  }, [map, features]);
}
