import { AOIInfo } from './AOIInfo';
import { DrawModeButtons } from './DrawModeButtons';
import { DatasetSelector, estimateFeatureCount } from './DatasetSelector';
import { FormatSelector } from './FormatSelector';
import { ExportButton } from './ExportButton';
import { GeoJSONUpload } from './GeoJSONUpload';
import { ExtractionHistory } from './ExtractionHistory';
import { AttributeFilter } from './AttributeFilter';
import { ColumnPicker } from './ColumnPicker';
import type { AOIState, ExtractionState, OutputFormat, Feature } from '../../types';
import type { SimpleUser } from '../../lib/firebase';

interface SidebarProps {
  aoiState: AOIState;
  selectedDatasets: string[];
  onDatasetsChange: (datasets: string[]) => void;
  selectedFormat: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  extractionState: ExtractionState;
  onExtract: () => void;
  onDownload: () => void;
  onGeoJSONUpload: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
  activeDrawMode: 'polygon' | 'rectangle' | null;
  onDrawModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
  user: SimpleUser | null;
  isAdmin: boolean;
  onLogout: () => void;
  onAdminClick: () => void;
  filteredFeatures: Feature[] | null;
  onFilter: (features: Feature[]) => void;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function Sidebar({
  aoiState,
  selectedDatasets,
  onDatasetsChange,
  selectedFormat,
  onFormatChange,
  extractionState,
  onExtract,
  onDownload,
  onGeoJSONUpload,
  activeDrawMode,
  onDrawModeChange,
  user,
  isAdmin,
  onLogout,
  onAdminClick,
  filteredFeatures,
  onFilter,
  selectedColumns,
  onColumnsChange,
}: SidebarProps) {
  const canExtract =
    aoiState.isValid &&
    selectedDatasets.length > 0 &&
    extractionState.status !== 'extracting' &&
    extractionState.status !== 'converting';

  const canDownload =
    extractionState.status === 'done' &&
    extractionState.result != null &&
    extractionState.result.features.length > 0;

  const featureEstimate = aoiState.isValid && aoiState.areaKm2 > 0
    ? estimateFeatureCount(selectedDatasets, aoiState.areaKm2)
    : null;

  const allFeatures = extractionState.result?.features ?? [];
  const displayFeatures = filteredFeatures ?? allFeatures;

  return (
    <div className="w-[340px] h-full glass flex flex-col overflow-y-auto">
      {/* Header + User */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                <path d="M16 3L28 9V23L16 29L4 23V9L16 3Z" stroke="white" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="3.5" fill="white" opacity="0.9" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">draw2data</h1>
              <p className="text-[10px] text-gray-400">Geospatial extraction</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={onAdminClick}
                className="w-7 h-7 rounded-xl bg-gray-100/80 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                title="Admin Dashboard"
              >
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] text-gray-400 hover:text-red-500 hover:bg-red-50/50 transition-all"
            >
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                {user?.displayName?.charAt(0).toUpperCase() || '?'}
              </span>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 px-5 pb-5 space-y-4 overflow-y-auto">
        {/* AOI */}
        <Section title="Area of Interest">
          <DrawModeButtons activeMode={activeDrawMode} onModeChange={onDrawModeChange} />
          <AOIInfo aoiState={aoiState} />
          <GeoJSONUpload onUpload={onGeoJSONUpload} />
        </Section>

        {/* Datasets */}
        <Section title="Datasets">
          <DatasetSelector
            selected={selectedDatasets}
            onChange={onDatasetsChange}
            featureEstimate={featureEstimate}
          />
        </Section>

        {/* Format */}
        <Section title="Output Format">
          <FormatSelector selected={selectedFormat} onChange={onFormatChange} />
        </Section>

        {/* Post-extraction tools */}
        {canDownload && (
          <Section title="Refine Results">
            <AttributeFilter features={allFeatures} onFilter={onFilter} />
            <ColumnPicker features={displayFeatures} selectedColumns={selectedColumns} onChange={onColumnsChange} />
          </Section>
        )}

        {/* History */}
        <ExtractionHistory />
      </div>

      {/* Sticky bottom */}
      <div className="px-5 py-4 border-t border-white/20">
        <ExportButton
          canExtract={canExtract}
          canDownload={canDownload}
          extractionState={extractionState}
          onExtract={onExtract}
          onDownload={onDownload}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );
}
