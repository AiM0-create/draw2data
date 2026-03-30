import { useState } from 'react';
import type { ExtractionState, DatasetSourceComparison, DataSource, Feature } from '../../types';

const SOURCE_LABELS: Record<DataSource, string> = {
  overture: 'Overture', osm: 'OSM', google: 'Google', microsoft: 'Microsoft', none: 'No data',
};
const SOURCE_DOTS: Record<DataSource, string> = {
  overture: 'bg-blue-500', osm: 'bg-green-500', google: 'bg-orange-500', microsoft: 'bg-purple-500', none: 'bg-red-400',
};

interface ExportButtonProps {
  canExtract: boolean;
  canDownload: boolean;
  extractionState: ExtractionState;
  onExtract: () => void;
  onDownload: () => void;
}

export function ExportButton({ canExtract, canDownload, extractionState, onExtract, onDownload }: ExportButtonProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const isLoading = extractionState.status === 'extracting' || extractionState.status === 'converting';
  const comparisons = extractionState.result?.metadata.sourceComparisons;
  const features = extractionState.result?.features;

  const handleCopyGeoJSON = async () => {
    if (!features) return;
    const geojson = JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
    await navigator.clipboard.writeText(geojson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href.split('?')[0]);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Extract */}
      <button
        onClick={onExtract}
        disabled={!canExtract}
        className={`w-full py-3 px-4 rounded-2xl text-sm font-semibold transition-all duration-200 ${
          canExtract
            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98]'
            : 'bg-gray-100/80 text-gray-300 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Extracting...
          </span>
        ) : (
          'Extract Data'
        )}
      </button>

      {/* Action row */}
      {canDownload && (
        <div className="flex gap-2">
          <button
            onClick={onDownload}
            className="flex-1 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl active:scale-[0.98] transition-all"
          >
            Download
          </button>
          <button
            onClick={handleCopyGeoJSON}
            className="py-2.5 px-3.5 rounded-2xl text-xs font-medium glass-card hover:bg-white/70 transition-all"
            title="Copy GeoJSON"
          >
            {copied ? '✓' : 'Copy'}
          </button>
          <button
            onClick={handleShare}
            className="py-2.5 px-3.5 rounded-2xl text-xs font-medium glass-card hover:bg-white/70 transition-all"
            title="Share link"
          >
            {shared ? '✓' : 'Share'}
          </button>
        </div>
      )}

      {/* Progress */}
      {extractionState.progress && (
        <div className={`text-xs px-3 py-2 rounded-xl ${
          extractionState.status === 'error' ? 'bg-red-50/80 text-red-600' : 'bg-indigo-50/60 text-indigo-600'
        }`}>
          {extractionState.progress}
        </div>
      )}
      {extractionState.error && (
        <div className="text-xs text-red-600 bg-red-50/80 rounded-xl px-3 py-2">
          {extractionState.error}
        </div>
      )}

      {/* Sources */}
      {comparisons && comparisons.length > 0 && (
        <SourceComparisons comparisons={comparisons} />
      )}

      {canDownload && features && <Legend features={features} />}
    </div>
  );
}

function SourceComparisons({ comparisons }: { comparisons: DatasetSourceComparison[] }) {
  return (
    <div className="glass-card rounded-xl p-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sources</p>
      {comparisons.map((c) => (
        <div key={c.dataset} className="flex items-center gap-2 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_DOTS[c.winner]}`} />
          <span className="font-medium text-gray-700 capitalize">{c.dataset}</span>
          <span className="text-gray-400 ml-auto">{SOURCE_LABELS[c.winner]}</span>
        </div>
      ))}
    </div>
  );
}

const LEGEND_ITEMS = [
  { label: 'Buildings', color: 'bg-red-500', ds: 'buildings' },
  { label: 'Places', color: 'bg-green-500', ds: 'places' },
  { label: 'Roads', color: 'bg-blue-500', ds: 'transportation' },
  { label: 'Land Use', color: 'bg-yellow-500', ds: 'land_use' },
  { label: 'Water', color: 'bg-sky-500', ds: 'water' },
  { label: 'Infra', color: 'bg-purple-500', ds: 'infrastructure' },
  { label: 'Addresses', color: 'bg-orange-500', ds: 'addresses' },
];

function Legend({ features }: { features: Feature[] }) {
  const presentDatasets = new Set(features.map((f) => f.properties?._dataset));
  const items = LEGEND_ITEMS.filter((it) => presentDatasets.has(it.ds));
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${it.color}`} />
          <span className="text-[11px] text-gray-400">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
