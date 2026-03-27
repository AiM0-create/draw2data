interface DrawModeButtonsProps {
  activeMode: 'polygon' | 'rectangle' | null;
  onModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
}

export function DrawModeButtons({ activeMode, onModeChange }: DrawModeButtonsProps) {
  const handleClick = (mode: 'polygon' | 'rectangle') => {
    if (activeMode === mode) {
      onModeChange(null);
    } else {
      onModeChange(mode);
    }
  };

  return (
    <div className="flex gap-2 mb-2">
      <button
        onClick={() => handleClick('rectangle')}
        className={`flex-1 text-xs py-1.5 px-3 rounded border transition-colors ${
          activeMode === 'rectangle'
            ? 'bg-blue-50 border-blue-400 text-blue-700'
            : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
        }`}
      >
        <svg className="inline w-3.5 h-3.5 mr-1 -mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="12" height="10" rx="0.5" />
        </svg>
        Rectangle
      </button>
      <button
        onClick={() => handleClick('polygon')}
        className={`flex-1 text-xs py-1.5 px-3 rounded border transition-colors ${
          activeMode === 'polygon'
            ? 'bg-blue-50 border-blue-400 text-blue-700'
            : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
        }`}
      >
        <svg className="inline w-3.5 h-3.5 mr-1 -mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="8,1 14,6 12,14 4,14 2,6" />
        </svg>
        Polygon
      </button>
    </div>
  );
}
