interface DrawModeButtonsProps {
  activeMode: 'polygon' | 'rectangle' | null;
  onModeChange: (mode: 'polygon' | 'rectangle' | null) => void;
}

export function DrawModeButtons({ activeMode, onModeChange }: DrawModeButtonsProps) {
  const handleClick = (mode: 'polygon' | 'rectangle') => {
    onModeChange(activeMode === mode ? null : mode);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleClick('rectangle')}
        className={`flex-1 text-xs py-2.5 px-3 rounded-xl font-medium transition-all duration-200 ${
          activeMode === 'rectangle'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
            : 'bg-white/60 text-gray-600 hover:bg-white/80 border border-gray-200/50'
        }`}
      >
        <svg className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
        </svg>
        Rectangle
      </button>
      <button
        onClick={() => handleClick('polygon')}
        className={`flex-1 text-xs py-2.5 px-3 rounded-xl font-medium transition-all duration-200 ${
          activeMode === 'polygon'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
            : 'bg-white/60 text-gray-600 hover:bg-white/80 border border-gray-200/50'
        }`}
      >
        <svg className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="8,1 14,6 12,14 4,14 2,6" />
        </svg>
        Polygon
      </button>
    </div>
  );
}
