import { DATASETS, DATASET_GROUPS } from '../../core/datasets';

interface DatasetSelectorProps {
  selected: string[];
  onChange: (datasets: string[]) => void;
  featureEstimate?: number | null;
}

const DENSITY_PER_KM2: Record<string, number> = {
  buildings: 3000, places: 400, transportation: 200,
  land_use: 50, water: 30, infrastructure: 100, addresses: 1500,
};

export function estimateFeatureCount(datasetIds: string[], areaKm2: number): number {
  return Math.round(datasetIds.reduce((sum, id) => sum + (DENSITY_PER_KM2[id] || 100) * areaKm2, 0));
}

const DS_ICONS: Record<string, string> = {
  buildings: '🏠', places: '📍', transportation: '🛣️',
  land_use: '🌿', water: '💧', infrastructure: '🚂', addresses: '📫',
};

export function DatasetSelector({ selected, onChange, featureEstimate }: DatasetSelectorProps) {
  const allIds = DATASETS.map((d) => d.id);
  const allSelected = allIds.every((id) => selected.includes(id));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((d) => d !== id) : [...selected, id]);
  };

  const toggleGroup = (ids: string[]) => {
    const allIn = ids.every((id) => selected.includes(id));
    onChange(allIn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(allSelected ? [] : allIds)}
          className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        {featureEstimate != null && featureEstimate > 0 && (
          <span className="text-[10px] text-gray-400 bg-gray-100/60 px-2 py-0.5 rounded-full">
            ~{featureEstimate.toLocaleString()} est.
          </span>
        )}
      </div>

      {DATASET_GROUPS.map((group) => {
        const groupIds = group.datasets.map((d) => d.id);
        const count = groupIds.filter((id) => selected.includes(id)).length;

        return (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(groupIds)}
              className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-indigo-500 transition-colors mb-1.5 flex items-center gap-1"
            >
              {group.label}
              {count > 0 && (
                <span className="text-[9px] bg-indigo-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center font-bold">
                  {count}
                </span>
              )}
            </button>
            <div className="space-y-1">
              {group.datasets.map((ds) => {
                const active = selected.includes(ds.id);
                return (
                  <button
                    key={ds.id}
                    onClick={() => toggle(ds.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-200 ${
                      active
                        ? 'bg-indigo-50/80 border border-indigo-200/50 shadow-sm'
                        : 'bg-white/40 border border-transparent hover:bg-white/60'
                    }`}
                  >
                    <span className="text-sm">{DS_ICONS[ds.id] || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${active ? 'text-indigo-700' : 'text-gray-700'}`}>{ds.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{ds.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      active ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`}>
                      {active && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
