import type { Feature, ExtractionResult, AOIGeometry } from '../../types';
import { getBbox } from '../../utils/geometry';
import { isOvertureEnabled } from '../../config';
import { queryOverture } from './overture';
import { queryOverpassCombined } from './overpass';

export async function extract(
  aoi: AOIGeometry,
  datasetIds: string[],
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const bbox = getBbox(aoi);

  let features: Feature[];

  if (isOvertureEnabled()) {
    try {
      features = await queryOverture(datasetIds, bbox, onProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.(`Overture failed (${msg}), falling back to OpenStreetMap...`);
      features = await queryOverpassCombined(datasetIds, bbox, onProgress);
    }
  } else {
    features = await queryOverpassCombined(datasetIds, bbox, onProgress);
  }

  return {
    features,
    metadata: {
      featureCount: features.length,
      datasetsQueried: datasetIds,
      durationMs: Date.now() - startTime,
    },
  };
}
