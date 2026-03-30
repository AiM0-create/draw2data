import type { DatasetConfig } from '../../types';
import { buildingsConfig } from './buildings';
import { placesConfig } from './places';
import { transportationConfig } from './transportation';
import { landUseConfig } from './land_use';
import { waterConfig } from './water';
import { infrastructureConfig } from './infrastructure';
import { addressesConfig } from './addresses';

export interface DatasetGroup {
  label: string;
  datasets: DatasetConfig[];
}

export const DATASET_GROUPS: DatasetGroup[] = [
  {
    label: 'Core',
    datasets: [buildingsConfig, placesConfig, transportationConfig],
  },
  {
    label: 'Environment',
    datasets: [landUseConfig, waterConfig],
  },
  {
    label: 'Other',
    datasets: [infrastructureConfig, addressesConfig],
  },
];

export const DATASETS: DatasetConfig[] = DATASET_GROUPS.flatMap((g) => g.datasets);

export function getDatasetById(id: string): DatasetConfig | undefined {
  return DATASETS.find((d) => d.id === id);
}
