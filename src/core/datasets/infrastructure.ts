import type { DatasetConfig } from '../../types';

export const infrastructureConfig: DatasetConfig = {
  id: 'infrastructure',
  name: 'Infrastructure',
  description: 'Railways, power lines, telecoms',
  theme: 'base',
  type: 'infrastructure',
  columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  geometryType: 'LineString',
};
