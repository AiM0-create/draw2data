import { AOIInfo } from './AOIInfo';
import { DrawModeButtons } from './DrawModeButtons';
import { DatasetSelector } from './DatasetSelector';
import { FormatSelector } from './FormatSelector';
import { ExportButton } from './ExportButton';
import { GeoJSONUpload } from './GeoJSONUpload';
import type { AOIState, ExtractionState, OutputFormat } from '../../types';

interface SidebarProps {
  aoiState: AOIState;
  selectedDatasets: string[];
  onDatasetsChange: (datasets: string[]) => void;
  selectedFormat: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  extractionState: ExtractionState;
  onExport: () => void;
  onGeoJSONUpload: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
  activeDrawMode: 'polygon' | 'rectangle' | null;
  onDrawModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
}

export function Sidebar({
  aoiState,
  selectedDatasets,
  onDatasetsChange,
  selectedFormat,
  onFormatChange,
  extractionState,
  onExport,
  onGeoJSONUpload,
  activeDrawMode,
  onDrawModeChange,
}: SidebarProps) {
  const canExport =
    aoiState.isValid &&
    selectedDatasets.length > 0 &&
    extractionState.status !== 'extracting' &&
    extractionState.status !== 'converting';

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">draw2data</h1>
        <p className="text-xs text-gray-500 mt-0.5">Extract geospatial data from open datasets</p>
      </div>

      {/* AOI Section */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Area of Interest</h2>
        <DrawModeButtons activeMode={activeDrawMode} onModeChange={onDrawModeChange} />
        <AOIInfo aoiState={aoiState} />
        <GeoJSONUpload onUpload={onGeoJSONUpload} />
      </div>

      {/* Dataset Section */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Datasets</h2>
        <DatasetSelector selected={selectedDatasets} onChange={onDatasetsChange} />
      </div>

      {/* Format Section */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Output Format</h2>
        <FormatSelector selected={selectedFormat} onChange={onFormatChange} />
      </div>

      {/* Export Section */}
      <div className="px-4 py-3 mt-auto">
        <ExportButton
          canExport={canExport}
          extractionState={extractionState}
          onExport={onExport}
        />
      </div>
    </div>
  );
}
