import { useState, useCallback, useRef } from 'react';
import type { AOIGeometry } from '../../types';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
  geojson?: { type: string; coordinates: unknown };
}

interface SearchBarProps {
  onFlyTo: (lng: number, lat: number, zoom: number) => void;
  onBoundarySelect?: (geometry: AOIGeometry) => void;
}

export function SearchBar({ onFlyTo, onBoundarySelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&polygon_geojson=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'draw2data/1.0' } });
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery(r.display_name.split(',')[0]);
    const [south, north, west, east] = r.boundingbox.map(Number);
    const lng = (west + east) / 2;
    const lat = (south + north) / 2;
    const span = Math.max(north - south, east - west);
    const zoom = span < 0.01 ? 16 : span < 0.1 ? 13 : span < 1 ? 10 : span < 5 ? 7 : 5;
    onFlyTo(lng, lat, zoom);
  };

  const handleUseBoundary = (r: SearchResult) => {
    if (!onBoundarySelect || !r.geojson) return;
    if (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon') {
      onBoundarySelect(r.geojson as AOIGeometry);
      setOpen(false);
      setQuery(r.display_name.split(',')[0]);
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-80">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search places..."
          className="w-full px-4 py-2.5 pl-9 text-sm glass rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-gray-700 placeholder-gray-400"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {loading && (
          <svg className="absolute right-3 top-3 w-4 h-4 text-indigo-500 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-2 glass rounded-2xl shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <div key={i} className="px-4 py-2.5 hover:bg-white/40 border-b border-white/10 last:border-0 transition-colors">
              <button onClick={() => handleSelect(r)} className="text-left w-full text-xs text-gray-700 truncate">
                {r.display_name}
              </button>
              {r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon') && onBoundarySelect && (
                <button
                  onClick={() => handleUseBoundary(r)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 mt-0.5 font-medium"
                >
                  Use boundary as AOI
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
