import type { DatasetConfig } from '../../types';

export const buildingsConfig: DatasetConfig = {
  id: 'buildings',
  name: 'Buildings',
  description: 'Building footprints from Overture Maps',
  theme: 'buildings',
  type: 'building',
  columns: ['id', 'names', 'class', 'subtype', 'height', 'num_floors', 'sources'],
  geometryType: 'Polygon',
};
