import type { Feature, OutputFormat } from '../../types';
import { toGeoJSONBlob } from './to-geojson';
import { toCSVBlob } from './to-csv';
import { toShapefileBlob } from './to-shapefile';
import { toKMLBlob } from './to-kml';
import { toGeoPackageBlob } from './to-gpkg';

const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  geojson: '.geojson',
  csv: '.csv',
  shapefile: '.zip',
  kml: '.kml',
  gpkg: '.gpkg',
};

export async function convertToFormat(
  features: Feature[],
  format: OutputFormat,
  selectedColumns?: string[]
): Promise<{ blob: Blob; filename: string }> {
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `draw2data-export-${timestamp}`;
  const extension = FORMAT_EXTENSIONS[format];

  // Filter columns if specified
  let processedFeatures = features;
  if (selectedColumns && selectedColumns.length > 0) {
    processedFeatures = features.map((f) => ({
      ...f,
      properties: Object.fromEntries(
        Object.entries(f.properties || {}).filter(
          ([k]) => k.startsWith('_') || selectedColumns.includes(k)
        )
      ),
    }));
  }

  let blob: Blob;

  switch (format) {
    case 'geojson':
      blob = toGeoJSONBlob(processedFeatures);
      break;
    case 'csv':
      blob = toCSVBlob(processedFeatures);
      break;
    case 'shapefile':
      blob = await toShapefileBlob(processedFeatures);
      break;
    case 'kml':
      blob = toKMLBlob(processedFeatures);
      break;
    case 'gpkg':
      blob = await toGeoPackageBlob(processedFeatures);
      break;
  }

  return { blob, filename: `${baseName}${extension}` };
}
