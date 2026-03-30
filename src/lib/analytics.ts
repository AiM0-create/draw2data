import type { ExtractionResult } from '../types';

export interface ExtractionLog {
  id: string;
  userEmail: string | null;
  datasets: string[];
  featureCount: number;
  durationMs: number;
  winners: Record<string, string>;
  areaKm2: number;
  timestamp: number;
}

const STORAGE_KEY = 'draw2data_analytics';
const MAX_LOGS = 500;

function loadLogs(): ExtractionLog[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ExtractionLog[];
  } catch {
    return [];
  }
}

function saveLogs(logs: ExtractionLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
}

export function logExtraction(
  userEmail: string | null,
  datasets: string[],
  result: ExtractionResult,
  areaKm2: number
): void {
  const winners: Record<string, string> = {};
  for (const comp of result.metadata.sourceComparisons ?? []) {
    winners[comp.dataset] = comp.winner;
  }

  const logs = loadLogs();
  logs.unshift({
    id: Date.now().toString(36),
    userEmail,
    datasets,
    featureCount: result.features.length,
    durationMs: result.metadata.durationMs,
    winners,
    areaKm2,
    timestamp: Date.now(),
  });
  saveLogs(logs);
}

export function fetchExtractionLogs(): ExtractionLog[] {
  return loadLogs();
}
