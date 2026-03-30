import type { DatasetConfig } from '../../types';

export const addressesConfig: DatasetConfig = {
  id: 'addresses',
  name: 'Addresses',
  description: 'Street addresses and postal codes',
  theme: 'addresses',
  type: 'address',
  columns: ['id', 'number', 'street', 'postcode', 'city', 'geometry', 'bbox'],
  geometryType: 'Point',
};
