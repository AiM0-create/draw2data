import type { Feature, OutputFormat } from '../../types';
import { toGeoJSONBlob } from './to-geojson';
import { toCSVBlob } from './to-csv';
import { toShapefileBlob } from './to-shapefile';

const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  geojson: '.geojson',
  csv: '.csv',
  shapefile: '.zip',
};

export async function convertToFormat(
  features: Feature[],
  format: OutputFormat
): Promise<{ blob: Blob; filename: string }> {
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseName = `draw2data-export-${timestamp}`;
  const extension = FORMAT_EXTENSIONS[format];

  let blob: Blob;

  switch (format) {
    case 'geojson':
      blob = toGeoJSONBlob(features);
      break;
    case 'csv':
      blob = toCSVBlob(features);
      break;
    case 'shapefile':
      blob = await toShapefileBlob(features);
      break;
  }

  return { blob, filename: `${baseName}${extension}` };
}
