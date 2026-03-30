import { useCallback, useRef, useState } from 'react';
import { parseGeoJSONFile } from '../../core/validation/aoi';
import type { AOIGeometry } from '../../types';

interface GeoJSONUploadProps {
  onUpload: (geometry: AOIGeometry) => void;
}

export function GeoJSONUpload({ onUpload }: GeoJSONUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const geometry = parseGeoJSONFile(text);
          onUpload(geometry);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to parse GeoJSON file.');
        }
      };
      reader.readAsText(file);
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div>
      <input ref={inputRef} type="file" accept=".geojson,.json" onChange={handleChange} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full text-[11px] py-2 px-3 border border-dashed border-gray-300/60 rounded-xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all"
      >
        Upload GeoJSON
      </button>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
