import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export type AOIGeometry = Polygon | MultiPolygon;

export interface AOIState {
  geometry: AOIGeometry | null;
  areaKm2: number;
  isValid: boolean;
  error: string | null;
}

export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon';

export interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  theme: string;
  type: string;
  columns: string[];
  geometryType: GeometryType;
}

export type OutputFormat = 'geojson' | 'csv' | 'shapefile';

export interface ExtractionRequest {
  aoi: AOIGeometry;
  datasets: string[];
  format: OutputFormat;
}

export interface ExtractionResult {
  features: Feature[];
  metadata: {
    featureCount: number;
    datasetsQueried: string[];
    durationMs: number;
  };
}

export type ExtractionStatus = 'idle' | 'extracting' | 'converting' | 'done' | 'error';

export interface ExtractionState {
  status: ExtractionStatus;
  progress: string;
  result: ExtractionResult | null;
  error: string | null;
}

export type { Feature, FeatureCollection, Polygon, MultiPolygon };
