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
      // Reset input so the same file can be re-uploaded
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full text-xs py-1.5 px-3 border border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        Upload GeoJSON
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
