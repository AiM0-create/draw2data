import type { AOIState } from '../../types';

interface AOIInfoProps {
  aoiState: AOIState;
}

export function AOIInfo({ aoiState }: AOIInfoProps) {
  if (!aoiState.geometry) {
    return (
      <p className="text-xs text-gray-400 italic">
        Draw a polygon on the map or upload a GeoJSON file.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Area</span>
        <span className="text-xs font-mono text-gray-800">
          {aoiState.areaKm2.toFixed(2)} km²
        </span>
      </div>
      {aoiState.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
          {aoiState.error}
        </p>
      )}
      {aoiState.isValid && (
        <p className="text-xs text-green-600">AOI is valid</p>
      )}
    </div>
  );
}
