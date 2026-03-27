import type { ExtractionState } from '../../types';

interface ExportButtonProps {
  canExport: boolean;
  extractionState: ExtractionState;
  onExport: () => void;
}

export function ExportButton({ canExport, extractionState, onExport }: ExportButtonProps) {
  const isLoading = extractionState.status === 'extracting' || extractionState.status === 'converting';

  return (
    <div className="space-y-2">
      <button
        onClick={onExport}
        disabled={!canExport}
        className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
          canExport
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Exporting...
          </span>
        ) : (
          'Export Data'
        )}
      </button>

      {/* Status messages */}
      {extractionState.progress && (
        <p className={`text-xs ${extractionState.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
          {extractionState.progress}
        </p>
      )}
      {extractionState.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
          {extractionState.error}
        </p>
      )}
    </div>
  );
}
