import type { OutputFormat } from '../../types';

const FORMATS: { id: OutputFormat; name: string; description: string }[] = [
  { id: 'geojson', name: 'GeoJSON', description: '.geojson' },
  { id: 'csv', name: 'CSV', description: '.csv with WKT geometry' },
  { id: 'shapefile', name: 'Shapefile', description: '.zip (SHP + DBF + SHX)' },
];

interface FormatSelectorProps {
  selected: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div className="space-y-2">
      {FORMATS.map((format) => (
        <label
          key={format.id}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <input
            type="radio"
            name="format"
            value={format.id}
            checked={selected === format.id}
            onChange={() => onChange(format.id)}
            className="border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-800 group-hover:text-blue-600">
              {format.name}
            </span>
            <span className="text-xs text-gray-400 ml-1">{format.description}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
