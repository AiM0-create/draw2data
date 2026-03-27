import { useEffect, useRef } from 'react';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  TerraDrawRenderMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AOIGeometry } from '../../types';

interface DrawControlProps {
  map: MaplibreMap | null;
  onAOIChange: (geometry: AOIGeometry | null) => void;
  onAOIClear: () => void;
  activeMode: 'polygon' | 'rectangle' | null;
  onModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
}

export function DrawControl({ map, onAOIChange, onAOIClear, activeMode, onModeChange }: DrawControlProps) {
  const drawRef = useRef<TerraDraw | null>(null);
  const prevModeRef = useRef<string | null>(null);

  // Initialize terra-draw when map is available
  useEffect(() => {
    if (!map) return;

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: {
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            outlineColor: '#3b82f6',
            outlineWidth: 2,
            closingPointColor: '#3b82f6',
            closingPointWidth: 4,
            closingPointOutlineColor: '#fff',
            closingPointOutlineWidth: 2,
          },
        }),
        new TerraDrawRectangleMode({
          styles: {
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            outlineColor: '#3b82f6',
            outlineWidth: 2,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: { feature: { draggable: true, coordinates: { draggable: true, deletable: true } } },
            rectangle: { feature: { draggable: true, coordinates: { draggable: true, deletable: false } } },
          },
          styles: {
            selectedPolygonColor: '#3b82f6',
            selectedPolygonFillOpacity: 0.2,
            selectedPolygonOutlineColor: '#2563eb',
            selectedPolygonOutlineWidth: 2,
            selectionPointColor: '#fff',
            selectionPointWidth: 5,
            selectionPointOutlineColor: '#3b82f6',
            selectionPointOutlineWidth: 2,
            midPointColor: '#3b82f6',
            midPointWidth: 3,
            midPointOutlineColor: '#fff',
            midPointOutlineWidth: 1,
          },
        }),
        new TerraDrawRenderMode({ modeName: 'static' }),
      ],
    });

    draw.start();
    drawRef.current = draw;

    // Listen for feature completion
    draw.on('finish', (id: string) => {
      const snapshot = draw.getSnapshot();
      const feature = snapshot.find((f) => f.id === id);
      if (feature && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
        // Remove any previously drawn features (keep only the latest)
        const otherIds = snapshot.filter((f) => f.id !== id && f.properties.mode !== 'static').map((f) => f.id);
        if (otherIds.length > 0) {
          draw.removeFeatures(otherIds as string[]);
        }
        onAOIChange(feature.geometry as AOIGeometry);
        // Switch to select mode after drawing
        draw.setMode('select');
        onModeChange(null);
      }
    });

    draw.on('change', () => {
      const snapshot = draw.getSnapshot();
      const drawnFeatures = snapshot.filter((f) => f.properties.mode !== 'static');
      if (drawnFeatures.length === 0) {
        onAOIClear();
      } else {
        const latest = drawnFeatures[drawnFeatures.length - 1];
        if (latest.geometry.type === 'Polygon' || latest.geometry.type === 'MultiPolygon') {
          onAOIChange(latest.geometry as AOIGeometry);
        }
      }
    });

    return () => {
      draw.stop();
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Handle mode changes from sidebar buttons
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    if (activeMode && activeMode !== prevModeRef.current) {
      // Clear previous drawings when starting a new draw
      const snapshot = draw.getSnapshot();
      const featureIds = snapshot.filter((f) => f.properties.mode !== 'static').map((f) => f.id);
      if (featureIds.length > 0) {
        draw.removeFeatures(featureIds as string[]);
      }
      draw.setMode(activeMode);
    } else if (!activeMode && prevModeRef.current) {
      draw.setMode('select');
    }

    prevModeRef.current = activeMode ?? null;
  }, [activeMode]);

  return null;
}
