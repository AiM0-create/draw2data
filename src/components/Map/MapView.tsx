import { useState, useCallback, useRef, useMemo } from 'react';
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawControl } from './DrawControl';
import { useResultsLayer } from './ResultsLayer';
import { FeatureCountOverlay } from './FeatureCountOverlay';
import { SearchBar } from './SearchBar';
import { BasemapToggle, getBasemapStyle, type BasemapId } from './BasemapToggle';
import type { AOIGeometry, Feature } from '../../types';

const INITIAL_VIEW = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
};

const AOI_FILL_PAINT = {
  'fill-color': '#6366f1',
  'fill-opacity': 0.15,
};

const AOI_LINE_PAINT = {
  'line-color': '#6366f1',
  'line-width': 2.5,
  'line-dasharray': [3, 2] as [number, number],
};

interface MapViewProps {
  aoiGeometry: AOIGeometry | null;
  onAOIChange: (geometry: AOIGeometry | null) => void;
  onAOIClear: () => void;
  activeDrawMode: 'polygon' | 'rectangle' | null;
  onDrawModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
  previewFeatures: Feature[] | null;
}

export function MapView({ aoiGeometry, onAOIChange, onAOIClear, activeDrawMode, onDrawModeChange, previewFeatures }: MapViewProps) {
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('light');
  const mapRef = useRef<MaplibreMap | null>(null);

  const handleMapLoad = useCallback((e: { target: MaplibreMap }) => {
    setMapInstance(e.target);
    mapRef.current = e.target;
  }, []);

  const handleFlyTo = useCallback((lng: number, lat: number, zoom: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });
  }, []);

  const handleBasemapChange = useCallback((id: BasemapId) => {
    setBasemap(id);
  }, []);

  const handleBoundarySelect = useCallback((geometry: AOIGeometry) => {
    onAOIChange(geometry);
  }, [onAOIChange]);

  // GeoJSON data for the AOI layer — memoized to avoid re-creating on every render
  const aoiData = useMemo(() => {
    if (!aoiGeometry) return { type: 'FeatureCollection' as const, features: [] as never[] };
    return { type: 'Feature' as const, properties: {}, geometry: aoiGeometry };
  }, [aoiGeometry]);

  // Render extraction results on map (imperative — results use multiple dynamic layers)
  useResultsLayer(mapInstance, previewFeatures);

  return (
    <div className="relative w-full h-full">
      <Map
        initialViewState={INITIAL_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={getBasemapStyle(basemap) as string}
        onLoad={handleMapLoad}
      >
        <NavigationControl position="bottom-right" />
        <DrawControl
          map={mapInstance}
          onAOIChange={onAOIChange}
          onAOIClear={onAOIClear}
          activeMode={activeDrawMode}
          onModeChange={onDrawModeChange}
        />

        {/* AOI boundary — declarative Source/Layer handles all lifecycle timing */}
        <Source id="aoi-source" type="geojson" data={aoiData}>
          <Layer id="aoi-fill" type="fill" paint={AOI_FILL_PAINT} />
          <Layer id="aoi-outline" type="line" paint={AOI_LINE_PAINT} />
        </Source>
      </Map>
      <SearchBar onFlyTo={handleFlyTo} onBoundarySelect={handleBoundarySelect} />
      <FeatureCountOverlay features={previewFeatures} />
      <BasemapToggle current={basemap} onChange={handleBasemapChange} />
    </div>
  );
}
