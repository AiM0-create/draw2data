/**
 * Overture Maps extraction via server-side worker.
 *
 * The worker handles all the heavy lifting: reads GeoParquet from Azure,
 * applies spatial filtering via row group statistics, converts WKB to GeoJSON,
 * and returns features. No rate limits, no CORS issues, no browser Parquet parsing.
 */

import type { Feature } from '../../types';
import { OVERTURE_PROXY_URL } from '../../config';

export async function queryOverture(
  datasetIds: string[],
  bbox: [number, number, number, number],
  onProgress?: (msg: string) => void
): Promise<Feature[]> {
  onProgress?.('Connecting to Overture Maps...');

  const response = await fetch(`${OVERTURE_PROXY_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datasets: datasetIds, bbox }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((err as { error?: string }).error || `Worker error: ${response.status}`);
  }

  const data = (await response.json()) as {
    features: Feature[];
    metadata: { featureCount: number; release: string };
  };

  onProgress?.(
    `Got ${data.metadata.featureCount} features from Overture Maps (${data.metadata.release})`
  );

  return data.features;
}
