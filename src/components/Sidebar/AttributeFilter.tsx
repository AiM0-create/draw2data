import { useState, useMemo } from 'react';
import type { Feature } from '../../types';

interface AttributeFilterProps {
  features: Feature[];
  onFilter: (filtered: Feature[]) => void;
}

interface FilterConfig {
  property: string;
  values: string[];
  selected: Set<string>;
}

export function AttributeFilter({ features, onFilter }: AttributeFilterProps) {
  const [expanded, setExpanded] = useState(false);

  // Discover filterable properties (class, category, _dataset)
  const filterConfigs = useMemo(() => {
    const props = ['_dataset', 'class', 'category'] as const;
    const configs: FilterConfig[] = [];

    for (const prop of props) {
      const valueCounts = new Map<string, number>();
      for (const f of features) {
        const val = f.properties?.[prop];
        if (val != null && val !== '') {
          const key = String(val);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }
      }
      if (valueCounts.size > 1 && valueCounts.size <= 30) {
        const sorted = [...valueCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([v]) => v);
        configs.push({
          property: prop,
          values: sorted,
          selected: new Set(sorted),
        });
      }
    }
    return configs;
  }, [features]);

  const [filters, setFilters] = useState<Map<string, Set<string>>>(new Map());

  if (filterConfigs.length === 0) return null;

  const toggleValue = (prop: string, val: string) => {
    const newFilters = new Map(filters);
    const config = filterConfigs.find((c) => c.property === prop);
    if (!config) return;

    let current = newFilters.get(prop) ?? new Set(config.values);
    current = new Set(current);
    if (current.has(val)) current.delete(val);
    else current.add(val);
    newFilters.set(prop, current);
    setFilters(newFilters);

    // Apply filters
    const filtered = features.filter((f) => {
      for (const [p, allowed] of newFilters) {
        const v = f.properties?.[p];
        if (v != null && v !== '' && !allowed.has(String(v))) return false;
      }
      return true;
    });
    onFilter(filtered);
  };

  const LABELS: Record<string, string> = {
    _dataset: 'Dataset',
    class: 'Class',
    category: 'Category',
  };

  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold text-gray-600 flex items-center gap-1 w-full"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 6l4 4-4 4V6z" />
        </svg>
        Filter Results
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {filterConfigs.map((config) => (
            <div key={config.property}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase">{LABELS[config.property] || config.property}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {config.values.slice(0, 15).map((val) => {
                  const active = !(filters.get(config.property)?.size) || (filters.get(config.property)?.has(val) ?? true);
                  return (
                    <button
                      key={val}
                      onClick={() => toggleValue(config.property, val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                        active
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-400 line-through'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
