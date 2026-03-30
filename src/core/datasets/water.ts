import type { DatasetConfig } from '../../types';

export const waterConfig: DatasetConfig = {
  id: 'water',
  name: 'Water Bodies',
  description: 'Rivers, lakes, reservoirs, coastlines',
  theme: 'base',
  type: 'water',
  columns: ['id', 'names', 'class', 'subtype', 'geometry', 'bbox'],
  geometryType: 'Polygon',
};
