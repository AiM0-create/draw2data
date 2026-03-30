import type { Feature } from '../../types';

const DATASET_LABELS: Record<string, { label: string; color: string }> = {
  buildings: { label: 'Buildings', color: '#ef4444' },
  places: { label: 'Places', color: '#16a34a' },
  transportation: { label: 'Roads', color: '#3b82f6' },
  land_use: { label: 'Land Use', color: '#ca8a04' },
  water: { label: 'Water', color: '#0284c7' },
  infrastructure: { label: 'Infrastructure', color: '#9333ea' },
  addresses: { label: 'Addresses', color: '#ea580c' },
};

interface FeatureCountOverlayProps {
  features: Feature[] | null;
}

export function FeatureCountOverlay({ features }: FeatureCountOverlayProps) {
  if (!features || features.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const f of features) {
    const ds = (f.properties?._dataset as string) || 'other';
    counts[ds] = (counts[ds] || 0) + 1;
  }

  return (
    <div className="absolute top-4 left-4 glass rounded-2xl shadow-lg px-4 py-3 pointer-events-auto z-10">
      <div className="text-xs font-bold text-gray-800 mb-1.5">
        {features.length.toLocaleString()} features
      </div>
      <div className="space-y-1">
        {Object.entries(counts).map(([ds, count]) => {
          const info = DATASET_LABELS[ds] || { label: ds, color: '#6b7280' };
          return (
            <div key={ds} className="flex items-center gap-2 text-[11px] text-gray-600">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
              <span>{info.label}</span>
              <span className="ml-auto font-semibold tabular-nums text-gray-800">{count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
