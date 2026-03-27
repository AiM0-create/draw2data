import type { DatasetConfig } from '../../types';
import { buildingsConfig } from './buildings';
import { placesConfig } from './places';
import { transportationConfig } from './transportation';

export const DATASETS: DatasetConfig[] = [
  buildingsConfig,
  placesConfig,
  transportationConfig,
];

export function getDatasetById(id: string): DatasetConfig | undefined {
  return DATASETS.find((d) => d.id === id);
}
