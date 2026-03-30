import { useState, useCallback, useRef } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawControl } from './DrawControl';
import { useResultsLayer } from './ResultsLayer';
import { useAOILayer } from './AOILayer';
import { FeatureCountOverlay } from './FeatureCountOverlay';
import { SearchBar } from './SearchBar';
import { BasemapToggle, getBasemapStyle, type BasemapId } from './BasemapToggle';
import type { AOIGeometry, Feature } from '../../types';

const INITIAL_VIEW = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
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
    // Style change will re-trigger via Map prop
  }, []);

  const handleBoundarySelect = useCallback((geometry: AOIGeometry) => {
    onAOIChange(geometry);
  }, [onAOIChange]);

  // Render AOI boundary on map
  useAOILayer(mapInstance, aoiGeometry);

  // Render extraction results on map
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
      </Map>
      <SearchBar onFlyTo={handleFlyTo} onBoundarySelect={handleBoundarySelect} />
      <FeatureCountOverlay features={previewFeatures} />
      <BasemapToggle current={basemap} onChange={handleBasemapChange} />
    </div>
  );
}
