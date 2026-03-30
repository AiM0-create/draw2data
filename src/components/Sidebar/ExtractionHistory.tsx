import { useState, useEffect } from 'react';

interface HistoryEntry {
  id: string;
  datasets: string[];
  featureCount: number;
  durationMs: number;
  timestamp: number;
}

const STORAGE_KEY = 'draw2data_history';
const MAX_ENTRIES = 20;

export function saveToHistory(datasets: string[], featureCount: number, durationMs: number) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as HistoryEntry[];
    existing.unshift({ id: Date.now().toString(36), datasets, featureCount, durationMs, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as HistoryEntry[];
  } catch { return []; }
}

export function ExtractionHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setHistory(loadHistory()); }, []);

  if (history.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 w-full"
      >
        <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 6l4 4-4 4V6z" />
        </svg>
        History
        <span className="text-[9px] bg-gray-200/60 text-gray-500 px-1.5 py-0.5 rounded-full ml-auto">{history.length}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {history.map((h) => (
            <div key={h.id} className="text-[11px] text-gray-500 flex justify-between items-center py-1 px-2 rounded-lg hover:bg-white/40 transition-colors">
              <span className="truncate flex-1">{h.datasets.join(', ')}</span>
              <span className="ml-2 text-gray-400 flex-shrink-0 tabular-nums">
                {h.featureCount.toLocaleString()}
              </span>
            </div>
          ))}
          <button
            onClick={() => { localStorage.removeItem(STORAGE_KEY); setHistory([]); }}
            className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
