import { useState, useCallback, useEffect } from 'react';
import { MapView } from './components/Map/MapView';
import { Sidebar } from './components/Sidebar/Sidebar';
import { LandingPage } from './components/Auth/LandingPage';
import { AdminDashboard } from './components/Auth/AdminDashboard';
import { useAOI } from './hooks/useAOI';
import { useExtraction } from './hooks/useExtraction';
import { useAuth } from './hooks/useAuth';
import { logExtraction } from './lib/analytics';
import type { AOIGeometry, OutputFormat, Feature } from './types';

function App() {
  const { aoiState, setAOI, clearAOI } = useAOI();
  const { extractionState, runExtraction, downloadResult, resetExtraction } = useExtraction();
  const { user, isAdmin, login, logout } = useAuth();
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['buildings']);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('geojson');
  const [activeDrawMode, setActiveDrawMode] = useState<'polygon' | 'rectangle' | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[] | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  useEffect(() => {
    setFilteredFeatures(null);
    if (extractionState.result?.features.length) {
      const cols = new Set<string>();
      for (const f of extractionState.result.features.slice(0, 50)) {
        if (f.properties) {
          for (const k of Object.keys(f.properties)) {
            if (!k.startsWith('_')) cols.add(k);
          }
        }
      }
      setSelectedColumns([...cols]);
    }
  }, [extractionState.result]);

  const handleExtract = useCallback(() => {
    if (!aoiState.geometry || !aoiState.isValid) return;
    resetExtraction();
    runExtraction(aoiState.geometry, selectedDatasets);
  }, [aoiState, selectedDatasets, runExtraction, resetExtraction]);

  useEffect(() => {
    if (extractionState.status === 'done' && extractionState.result && extractionState.result.features.length > 0) {
      logExtraction(user?.email ?? null, extractionState.result.metadata.datasetsQueried, extractionState.result, aoiState.areaKm2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionState.status]);

  const handleDownload = useCallback(() => {
    downloadResult(selectedFormat, selectedColumns.length > 0 ? selectedColumns : undefined);
  }, [downloadResult, selectedFormat, selectedColumns]);

  const handleGeoJSONUpload = useCallback((geometry: AOIGeometry) => { setAOI(geometry); }, [setAOI]);

  // Gate behind login
  if (!user) {
    return <LandingPage onLogin={login} />;
  }

  const allFeatures = extractionState.result?.features ?? null;
  const previewFeatures = filteredFeatures ?? allFeatures;

  return (
    <div className="flex h-full bg-gray-50">
      <div className="flex-1 relative">
        <MapView
          aoiGeometry={aoiState.geometry}
          onAOIChange={setAOI}
          onAOIClear={clearAOI}
          activeDrawMode={activeDrawMode}
          onDrawModeChange={setActiveDrawMode}
          previewFeatures={previewFeatures}
        />
      </div>

      <Sidebar
        aoiState={aoiState}
        selectedDatasets={selectedDatasets}
        onDatasetsChange={setSelectedDatasets}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        extractionState={extractionState}
        onExtract={handleExtract}
        onDownload={handleDownload}
        onGeoJSONUpload={handleGeoJSONUpload}
        activeDrawMode={activeDrawMode}
        onDrawModeChange={setActiveDrawMode}
        user={user}
        isAdmin={isAdmin}
        onLogout={logout}
        onAdminClick={() => setShowAdmin(true)}
        filteredFeatures={filteredFeatures}
        onFilter={setFilteredFeatures}
        selectedColumns={selectedColumns}
        onColumnsChange={setSelectedColumns}
      />

      {showAdmin && isAdmin && (
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}

export default App;
