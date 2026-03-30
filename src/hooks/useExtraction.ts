import { useState, useCallback } from 'react';
import type { AOIGeometry, ExtractionState, OutputFormat } from '../types';
import { extract } from '../core/extraction/extractor';
import { convertToFormat } from '../core/conversion';
import { downloadBlob } from '../utils/download';
import { saveToHistory } from '../components/Sidebar/ExtractionHistory';

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    status: 'idle',
    progress: '',
    result: null,
    error: null,
  });

  const runExtraction = useCallback(
    async (aoi: AOIGeometry, datasetIds: string[]) => {
      setState({ status: 'extracting', progress: 'Starting extraction...', result: null, error: null });

      try {
        const result = await extract(aoi, datasetIds, (msg) => {
          setState((prev) => ({ ...prev, progress: msg }));
        });

        // Save to localStorage history
        saveToHistory(datasetIds, result.features.length, result.metadata.durationMs);

        if (result.features.length === 0) {
          setState({
            status: 'done',
            progress: 'No features found in this area.',
            result,
            error: null,
          });
          return;
        }

        setState({
          status: 'done',
          progress: `Extracted ${result.features.length} features in ${(result.metadata.durationMs / 1000).toFixed(1)}s — preview on map`,
          result,
          error: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setState({
          status: 'error',
          progress: '',
          result: null,
          error: message,
        });
      }
    },
    []
  );

  const downloadResult = useCallback(
    async (format: OutputFormat, selectedColumns?: string[]) => {
      if (!state.result || state.result.features.length === 0) return;
      setState((prev) => ({ ...prev, status: 'converting', progress: `Converting ${prev.result!.features.length} features to ${format}...` }));

      try {
        const { blob, filename } = await convertToFormat(state.result.features, format, selectedColumns);
        downloadBlob(blob, filename);
        setState((prev) => ({
          ...prev,
          status: 'done',
          progress: `Downloaded ${prev.result!.features.length} features as ${format}`,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Download failed.';
        setState((prev) => ({ ...prev, status: 'error', error: message }));
      }
    },
    [state.result]
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: '', result: null, error: null });
  }, []);

  return { extractionState: state, runExtraction, downloadResult, resetExtraction: reset };
}
