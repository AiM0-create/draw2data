import { useState, useCallback } from 'react';
import type { AOIGeometry, AOIState } from '../types';
import { computeAOIState } from '../core/validation/aoi';

export function useAOI() {
  const [aoiState, setAOIState] = useState<AOIState>({
    geometry: null,
    areaKm2: 0,
    isValid: false,
    error: null,
  });

  const setAOI = useCallback((geometry: AOIGeometry | null) => {
    setAOIState(computeAOIState(geometry));
  }, []);

  const clearAOI = useCallback(() => {
    setAOIState({ geometry: null, areaKm2: 0, isValid: false, error: null });
  }, []);

  return { aoiState, setAOI, clearAOI };
}
