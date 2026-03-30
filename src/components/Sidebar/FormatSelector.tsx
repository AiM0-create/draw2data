import type { OutputFormat } from '../../types';

const FORMATS: { id: OutputFormat; name: string; desc: string }[] = [
  { id: 'geojson', name: 'GeoJSON', desc: '.geojson' },
  { id: 'csv', name: 'CSV', desc: '.csv' },
  { id: 'shapefile', name: 'SHP', desc: '.zip' },
  { id: 'kml', name: 'KML', desc: '.kml' },
  { id: 'gpkg', name: 'GPKG', desc: '.gpkg' },
];

interface FormatSelectorProps {
  selected: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
            selected === f.id
              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white/60 text-gray-500 hover:bg-white/80 border border-gray-200/40'
          }`}
          title={f.desc}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
