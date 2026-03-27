import { useState, useCallback } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawControl } from './DrawControl';
import type { AOIGeometry } from '../../types';

const INITIAL_VIEW = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface MapViewProps {
  onAOIChange: (geometry: AOIGeometry | null) => void;
  onAOIClear: () => void;
  activeDrawMode: 'polygon' | 'rectangle' | null;
  onDrawModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
}

export function MapView({ onAOIChange, onAOIClear, activeDrawMode, onDrawModeChange }: MapViewProps) {
  const [mapInstance, setMapInstance] = useState<MaplibreMap | null>(null);

  const handleMapLoad = useCallback((e: { target: MaplibreMap }) => {
    setMapInstance(e.target);
  }, []);

  return (
    <Map
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
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
  );
}
