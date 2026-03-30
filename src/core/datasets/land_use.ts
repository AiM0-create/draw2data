import type { DatasetConfig } from '../../types';

export const landUseConfig: DatasetConfig = {
  id: 'land_use',
  name: 'Land Use',
  description: 'Parks, forests, farmland, residential zones',
  theme: 'base',
  type: 'land_use',
  columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  geometryType: 'Polygon',
};
