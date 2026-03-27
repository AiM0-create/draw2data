import { useState, useCallback } from 'react';
import { MapView } from './components/Map/MapView';
import { Sidebar } from './components/Sidebar/Sidebar';
import { useAOI } from './hooks/useAOI';
import { useExtraction } from './hooks/useExtraction';
import type { AOIGeometry, OutputFormat } from './types';

function App() {
  const { aoiState, setAOI, clearAOI } = useAOI();
  const { extractionState, runExtraction, resetExtraction } = useExtraction();
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['buildings']);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('geojson');
  const [activeDrawMode, setActiveDrawMode] = useState<'polygon' | 'rectangle' | null>(null);

  const handleExport = useCallback(() => {
    if (!aoiState.geometry || !aoiState.isValid) return;
    resetExtraction();
    runExtraction(aoiState.geometry, selectedDatasets, selectedFormat);
  }, [aoiState, selectedDatasets, selectedFormat, runExtraction, resetExtraction]);

  const handleGeoJSONUpload = useCallback(
    (geometry: AOIGeometry) => {
      setAOI(geometry);
    },
    [setAOI]
  );

  return (
    <div className="flex h-full">
      {/* Map takes remaining space */}
      <div className="flex-1 relative">
        <MapView
          onAOIChange={setAOI}
          onAOIClear={clearAOI}
          activeDrawMode={activeDrawMode}
          onDrawModeChange={setActiveDrawMode}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        aoiState={aoiState}
        selectedDatasets={selectedDatasets}
        onDatasetsChange={setSelectedDatasets}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        extractionState={extractionState}
        onExport={handleExport}
        onGeoJSONUpload={handleGeoJSONUpload}
        activeDrawMode={activeDrawMode}
        onDrawModeChange={setActiveDrawMode}
      />
    </div>
  );
}

export default App;
