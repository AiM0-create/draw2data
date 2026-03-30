import type { DatasetConfig } from '../../types';

export const placesConfig: DatasetConfig = {
  id: 'places',
  name: 'Places / POIs',
  description: 'Points of interest from open datasets',
  theme: 'places',
  type: 'place',
  columns: ['id', 'names', 'categories', 'confidence', 'websites', 'socials', 'phones', 'addresses', 'sources'],
  geometryType: 'Point',
};
