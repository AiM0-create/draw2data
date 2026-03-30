import type { Feature, ExtractionResult, AOIGeometry, DatasetSourceComparison } from '../../types';
import { getBbox } from '../../utils/geometry';
import { isOvertureEnabled, OVERTURE_PROXY_URL } from '../../config';
import { queryOverpassCombined } from './overpass';

export async function extract(
  aoi: AOIGeometry,
  datasetIds: string[],
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const bbox = getBbox(aoi);

  if (isOvertureEnabled()) {
    return extractViaWorker(datasetIds, bbox, startTime, onProgress);
  }

  // Fallback: browser-side Overpass only (no worker configured)
  onProgress?.('Querying OpenStreetMap...');
  const features = await queryOverpassCombined(datasetIds, bbox, onProgress);
  return {
    features,
    metadata: {
      featureCount: features.length,
      datasetsQueried: datasetIds,
      durationMs: Date.now() - startTime,
    },
  };
}

async function extractViaWorker(
  datasetIds: string[],
  bbox: [number, number, number, number],
  startTime: number,
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  onProgress?.(`Querying sources for ${datasetIds.join(', ')}...`);

  // Simulate live progress while waiting for API response
  const progressMessages = [
    { delay: 2000, msg: 'Querying Overture Maps (GeoParquet)...' },
    { delay: 4000, msg: 'Querying OpenStreetMap (Overpass)...' },
    { delay: 7000, msg: 'Querying Google Open Buildings...' },
    { delay: 10000, msg: 'Querying Microsoft Building Footprints...' },
    { delay: 15000, msg: 'Comparing source coverage...' },
    { delay: 25000, msg: 'Still working — large area takes longer...' },
    { delay: 40000, msg: 'Almost there — finalizing results...' },
  ];
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const { delay, msg } of progressMessages) {
    timers.push(setTimeout(() => onProgress?.(msg), delay));
  }

  try {
    // Single API call — server processes all datasets in parallel
    const response = await fetch(`${OVERTURE_PROXY_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasets: datasetIds, bbox }),
    });

    // Clear progress timers once response arrives
    for (const t of timers) clearTimeout(t);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error((err as { error?: string }).error || `Worker error: ${response.status}`);
    }

    onProgress?.('Processing response...');

    const data = (await response.json()) as {
      features: Feature[];
      metadata: {
        featureCount: number;
        release: string;
        sourceComparisons?: DatasetSourceComparison[];
      };
    };

    if (data.metadata.sourceComparisons) {
      for (const comp of data.metadata.sourceComparisons) {
        const sources = comp.sources.map(s => `${s.source}=${s.featureCount}`).join(' vs ');
        onProgress?.(`${comp.dataset}: ${comp.winner === 'none' ? 'no data found' : `${comp.winner} won`} (${sources})`);
      }
    }

    return {
      features: data.features,
      metadata: {
        featureCount: data.features.length,
        datasetsQueried: datasetIds,
        durationMs: Date.now() - startTime,
        sourceComparisons: data.metadata.sourceComparisons,
      },
    };
  } catch (err) {
    for (const t of timers) clearTimeout(t);
    throw err;
  }
}
