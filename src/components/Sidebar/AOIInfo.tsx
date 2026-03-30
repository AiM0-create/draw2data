import type { AOIState } from '../../types';

interface AOIInfoProps {
  aoiState: AOIState;
}

export function AOIInfo({ aoiState }: AOIInfoProps) {
  if (!aoiState.geometry) {
    return (
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Draw on the map or search a place to set your area of interest.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/50">
        <span className="text-[11px] text-gray-500">Area</span>
        <span className="text-xs font-semibold text-gray-800 font-mono">
          {aoiState.areaKm2.toFixed(2)} km²
        </span>
      </div>
      {aoiState.error && (
        <div className="text-[11px] text-red-600 bg-red-50/60 rounded-xl px-3 py-2">
          {aoiState.error}
        </div>
      )}
      {aoiState.isValid && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
          AOI ready
        </div>
      )}
    </div>
  );
}
