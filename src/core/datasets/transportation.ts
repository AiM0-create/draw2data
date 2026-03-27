import type { DatasetConfig } from '../../types';

export const transportationConfig: DatasetConfig = {
  id: 'transportation',
  name: 'Roads / Transportation',
  description: 'Road network from Overture Maps',
  theme: 'transportation',
  type: 'segment',
  columns: ['id', 'names', 'class', 'subclass', 'sources'],
  geometryType: 'LineString',
};
