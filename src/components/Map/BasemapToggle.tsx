export type BasemapId = 'light' | 'dark' | 'satellite';

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: 'raster' as const,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite', type: 'raster' as const, source: 'satellite' }],
};

const BASEMAPS: { id: BasemapId; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'satellite', label: 'Satellite', icon: '🛰️' },
];

interface BasemapToggleProps {
  current: BasemapId;
  onChange: (id: BasemapId) => void;
}

export function BasemapToggle({ current, onChange }: BasemapToggleProps) {
  return (
    <div className="absolute bottom-12 left-3 z-10 flex glass rounded-2xl shadow-lg overflow-hidden">
      {BASEMAPS.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={`px-3 py-2 text-[11px] font-medium transition-all duration-200 flex items-center gap-1 ${
            current === b.id
              ? 'bg-indigo-500 text-white shadow-inner'
              : 'text-gray-600 hover:bg-white/50'
          }`}
        >
          <span className="text-xs">{b.icon}</span>
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function getBasemapStyle(id: BasemapId): string | object {
  switch (id) {
    case 'light': return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    case 'dark': return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    case 'satellite': return SATELLITE_STYLE;
  }
}
