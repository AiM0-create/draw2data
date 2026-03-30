import { useState, useMemo } from 'react';
import type { Feature } from '../../types';

interface ColumnPickerProps {
  features: Feature[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
}

export function ColumnPicker({ features, selectedColumns, onChange }: ColumnPickerProps) {
  const [expanded, setExpanded] = useState(false);

  const allColumns = useMemo(() => {
    const cols = new Set<string>();
    for (const f of features.slice(0, 100)) {
      if (f.properties) {
        for (const key of Object.keys(f.properties)) {
          if (!key.startsWith('_')) cols.add(key);
        }
      }
    }
    return [...cols].sort();
  }, [features]);

  if (allColumns.length === 0) return null;

  const toggle = (col: string) => {
    if (selectedColumns.includes(col)) {
      onChange(selectedColumns.filter((c) => c !== col));
    } else {
      onChange([...selectedColumns, col]);
    }
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
        Columns ({selectedColumns.length}/{allColumns.length})
      </button>

      {expanded && (
        <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
          <button
            onClick={() => onChange(allColumns)}
            className="text-[10px] text-blue-600 hover:text-blue-800 mr-2"
          >
            All
          </button>
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-red-400 hover:text-red-600"
          >
            None
          </button>
          {allColumns.map((col) => (
            <label key={col} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedColumns.includes(col)}
                onChange={() => toggle(col)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
              />
              <span className="text-xs text-gray-600">{col}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
